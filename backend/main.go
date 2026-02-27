package main

import (
	"Wallet/backend/config"
	"Wallet/backend/routes"
	"Wallet/backend/services"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func main() {
	log.Println("Starting Wallet Backend Service...")

	// Load configuration
	log.Println("Loading configuration...")
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection with retries
	log.Println("Connecting to database...")
	var db *gorm.DB
	maxRetries := 5
	retryDelay := time.Second * 3

	for i := 0; i < maxRetries; i++ {
		db, err = config.InitDB(cfg)
		if err == nil {
			break
		}
		if i < maxRetries-1 {
			log.Printf("Failed to connect to database (attempt %d/%d): %v", i+1, maxRetries, err)
			time.Sleep(retryDelay)
			continue
		}
		log.Fatalf("Failed to initialize database after %d attempts: %v", maxRetries, err)
	}

	// Ensure we can actually use the database
	if err := config.EnsureDatabaseConnection(db); err != nil {
		log.Fatalf("Database connection validation failed: %v", err)
	}

	// Validate database schema
	log.Println("Validating database schema...")
	if err := config.InitializeDatabase(db); err != nil {
		log.Printf("Warning: Database schema validation failed: %v", err)
		log.Println("Continuing anyway - some features may not work correctly")
	} else {
		log.Println("Database schema validation successful")
	}

	// Start on-chain event listener (QuadraticVoting → ConfirmedScam sync)
	log.Println("Starting on-chain event listener...")
	eventListener, err := services.NewEventListenerService(db)
	if err != nil {
		log.Printf("Warning: Failed to initialize event listener: %v", err)
		log.Println("Continuing without on-chain event sync — DAO data will not auto-update")
	} else {
		eventListener.Start()
		defer eventListener.Stop()
	}

	// Setup router with services
	log.Println("Setting up API routes...")
	r := routes.SetupMainRouter(db)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Set gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Start server
	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
	fmt.Println(`
    __        __    _ _      _            _____
    \ \      / /_ _| | | ___| |_   ___   |  ___|_ _ ___ ___
     \ \ /\ / / _' | | |/ _ \ __| / _ \  | |_ / _' / __/ _ \
      \ V  V / (_| | | |  __/ |_ |  __/  |  _| (_| \__ \  __/
       \_/\_/ \__,_|_|_|\___|\__| \___|  |_|  \__,_|___/\___|

    Wallet Firewall API Server | Secure Transactions`)
	fmt.Printf("    Version 1.0.0 | Environment: %s\n\n", cfg.Environment)

	// Start server
	log.Printf("Server listening on port %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
