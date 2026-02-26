package handlers

import (
	"Wallet/backend/services"
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
)

type CivicAuthHandler struct {
	civicService *services.CivicAuthService
}

func NewCivicAuthHandler(civicService *services.CivicAuthService) *CivicAuthHandler {
	return &CivicAuthHandler{
		civicService: civicService,
	}
}

// InitiateAuthHandler starts the Civic authentication process
func (h *CivicAuthHandler) InitiateAuthHandler(c *gin.Context) {
	var req struct {
		UserAddress string `json:"userAddress" binding:"required"`
		DeviceInfo  string `json:"deviceInfo" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	session, err := h.civicService.InitiateAuth(req.UserAddress, req.DeviceInfo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"gatepass": session.GatePass,
		"status":   session.Status,
		"expires":  session.TokenExpiry,
	})
}

// VerifyGatepassHandler validates the Civic gatepass
func (h *CivicAuthHandler) VerifyGatepassHandler(c *gin.Context) {
	var req struct {
		UserAddress string `json:"userAddress" binding:"required"`
		Gatepass    string `json:"gatepass" binding:"required"`
		DeviceInfo  string `json:"deviceInfo" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	session, err := h.civicService.VerifyGatepass(req.UserAddress, req.Gatepass, req.DeviceInfo)
	if err != nil {
		response := gin.H{"error": err.Error()}
		if session != nil {
			response["requiresAdditionalVerification"] = session.Status == "needs_additional_verification"
			response["riskScore"] = session.RiskScore
			response["securityFlags"] = session.Flags
		}
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        session.Status,
		"securityLevel": session.SecurityLevel,
		"expires":       session.TokenExpiry,
		"lastVerified":  session.LastVerified,
	})
}

// GetAuthStatusHandler returns the current authentication status
func (h *CivicAuthHandler) GetAuthStatusHandler(c *gin.Context) {
	userAddress := c.Query("userAddress")
	if userAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User address is required"})
		return
	}

	session, err := h.civicService.GetUserSession(userAddress)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active session found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        session.Status,
		"securityLevel": session.SecurityLevel,
		"expires":       session.TokenExpiry,
		"lastVerified":  session.LastVerified,
		"riskScore":     session.RiskScore,
		"securityFlags": session.Flags,
	})
}

// RequireCivicAuth middleware ensures valid Civic authentication
func (h *CivicAuthHandler) RequireCivicAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userAddress := c.GetHeader("X-User-Address")
		if userAddress == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User address is required"})
			c.Abort()
			return
		}
		session, err := h.civicService.GetUserSession(userAddress)
		if err != nil || session.Status != "verified" || session.TokenExpiry.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Valid Civic authentication required"})
			c.Abort()
			return
		}

		// Add session to context for downstream handlers
		c.Set("civicSession", session)
		c.Next()
	}
}

// RequireValidAuth middleware ensures the Civic authentication is valid and not expired
func (h *CivicAuthHandler) RequireValidAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userAddress := c.GetHeader("X-User-Address")
		if userAddress == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-User-Address header required"})
			c.Abort()
			return
		}

		session, err := h.civicService.GetUserSession(userAddress)
		if err != nil || session.Status != "verified" || session.TokenExpiry.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Valid Civic authentication required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
