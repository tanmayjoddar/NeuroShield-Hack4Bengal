package routes

import (
	"Wallet/backend/handlers"
	"Wallet/backend/middleware"
	"Wallet/backend/services"
	"log"
	"net/http"
	"os"

	"gorm.io/gorm"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRouter configures all API routes
func SetupMainRouter(db *gorm.DB, telegramService *services.TelegramService) *gin.Engine {
	r := gin.Default()
	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "https://*.onrender.com", "https://*.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Wallet-Address", "X-Wallet-Signature", "X-Wallet-Message", "X-User-Address"},
		AllowCredentials: true,
	}))
	// Health check endpoint for Render and monitoring
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":      "ok",
			"service":     "wallet-backend",
			"environment": os.Getenv("ENVIRONMENT"),
			"version":     "1.0.0",
		})
	})

	// Initialize services
	ethRpcUrl := os.Getenv("ETH_RPC_URL")
	if ethRpcUrl == "" {
		ethRpcUrl = "https://eth-sepolia.g.alchemy.com/v2/your-api-key" // Default value
	}

	// Initialize blockchain service
	blockchainService, err := services.NewBlockchainService()
	if err != nil {
		log.Printf("Warning: Failed to initialize blockchain service: %v", err)
		// Continue with nil blockchain service, handlers should handle this case
	}

	analyticsService, err := services.NewWalletAnalyticsService(db, ethRpcUrl)
	if err != nil {
		log.Printf("Warning: Failed to initialize analytics service: %v", err)
		// Use a minimal analytics service if initialization fails
		analyticsService, _ = services.NewWalletAnalyticsService(db, "")
	}

	aiService := services.NewAIServiceWithDB(analyticsService, db)

	// Initialize Civic Auth service
	civicConfig := &services.CivicConfig{
		GatekeeperNetwork: os.Getenv("CIVIC_GATEKEEPER_NETWORK"),
		ChainId:          11155111, // Sepolia testnet
		ApiKey:           os.Getenv("CIVIC_API_KEY"),
		Stage:            os.Getenv("CIVIC_STAGE"), // "prod" or "preprod"
	}

	civicService := services.NewCivicAuthService(db, civicConfig)
	civicHandler := handlers.NewCivicAuthHandler(civicService)

	// Create handler instances with the database connection and services
	firewallHandler := handlers.NewFirewallHandler(db, aiService, telegramService)
	reportHandler := handlers.NewReportHandler(db, blockchainService, telegramService)
	daoHandler := handlers.NewDAOHandler(db, blockchainService)
	authHandler := handlers.NewAuthHandler(blockchainService)
	analyticsHandler := handlers.NewWalletAnalyticsHandler(analyticsService)

	// Apply rate limiting to all API routes
	r.Use(middleware.RateLimitMiddleware())

	// Public API routes
	api := r.Group("/api")
	{
		// Civic Auth endpoints
		api.POST("/auth/civic/initiate", civicHandler.InitiateAuthHandler)
		api.POST("/auth/civic/verify", civicHandler.VerifyGatepassHandler)
		api.GET("/auth/civic/status", civicHandler.GetAuthStatusHandler)

		// Auth endpoints
		api.POST("/auth/verify", authHandler.VerifyWalletSignature)
		api.GET("/auth/nonce", authHandler.GetSignatureNonce)

		// Public firewall endpoints
		api.POST("/firewall/tx", firewallHandler.AnalyzeTransaction)
		api.GET("/firewall/stats", firewallHandler.GetStats)

		// Public DAO endpoints
		api.GET("/dao/proposals", daoHandler.GetProposals)
		api.GET("/dao/scamscore/:address", daoHandler.GetScamScore)
		api.GET("/dao/address/:address", daoHandler.GetAddressStatus)

		// Wallet analytics endpoints
		api.GET("/analytics/wallet/:address", analyticsHandler.GetWalletAnalytics)
		api.GET("/analytics/risk/:address", analyticsHandler.GetWalletRiskScore)
		api.POST("/analytics/bulk", analyticsHandler.GetBulkWalletAnalytics)
		api.POST("/analytics/export", analyticsHandler.ExportMLDataset)
	}

	// Create a new protected group that requires both Web3 and Civic Auth
	secureAuth := r.Group("/api/secure")
	secureAuth.Use(middleware.Web3AuthMiddleware(blockchainService))
	secureAuth.Use(civicHandler.RequireCivicAuth())
	{
		// High-security operations that require both wallet signature and Civic verification
		secureAuth.POST("/transaction/high-value", firewallHandler.AnalyzeHighValueTransaction)
		secureAuth.POST("/report/critical", reportHandler.CreateCriticalReport)
		secureAuth.POST("/recovery/initiate", reportHandler.InitiateRecovery)
	}

	// Web3 authenticated routes (using wallet signature)
	web3Auth := r.Group("/api")
	web3Auth.Use(middleware.Web3AuthMiddleware(blockchainService))
	{
		// Report endpoints
		web3Auth.POST("/report", reportHandler.CreateReport)
		web3Auth.GET("/reports", reportHandler.GetReports)

		// Protected DAO endpoints
		web3Auth.POST("/dao/vote", daoHandler.CastVote)
		web3Auth.POST("/dao/proposals", daoHandler.CreateProposal)

		// Recovery endpoints
		web3Auth.POST("/recovery/initiate", reportHandler.InitiateRecovery)
		web3Auth.GET("/recovery/status/:txHash", reportHandler.CheckRecoveryStatus)

		// User profile and transaction history
		web3Auth.GET("/transactions", firewallHandler.GetTransactions)
		web3Auth.GET("/profile", authHandler.GetWalletProfile)
	}

	// Admin routes (JWT authenticated)
	admin := r.Group("/api/admin")
	admin.Use(middleware.JWTAuthMiddleware())
	{
		admin.GET("/reports", reportHandler.GetAllReports)
		admin.PUT("/reports/:id/verify", reportHandler.VerifyReport)
		admin.GET("/stats", firewallHandler.GetAdminStats)
	}

	// Telegram webhook endpoint
	// This doesn't need authentication as it's secured by the Telegram API
	r.POST("/telegram/webhook", telegramService.GetWebhookHandler())

	// Telegram account linking endpoint (requires Web3 auth)
	web3Auth.POST("/telegram/link", func(c *gin.Context) {
		var req struct {
			TelegramChatID string `json:"telegram_chat_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		// Get user wallet address from auth middleware
		address, exists := c.Get("address")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
			return
		}
		// Link Telegram chat to wallet with empty user details (will be updated when user interacts with the bot)
		if err := telegramService.LinkWallet(req.TelegramChatID, address.(string), "", "", ""); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to link Telegram account: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Telegram account successfully linked to wallet",
		})
	})

	return r
}
