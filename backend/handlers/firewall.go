package handlers

import (
	"Wallet/backend/models"
	"Wallet/backend/services"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// FirewallHandler handles transaction firewall endpoints
type FirewallHandler struct {
	db        *gorm.DB
	aiService *services.AIService
}

// NewFirewallHandler creates a new firewall handler
func NewFirewallHandler(db *gorm.DB, aiService *services.AIService) *FirewallHandler {
	return &FirewallHandler{
		db:        db,
		aiService: aiService,
	}
}

// AnalyzeTransaction analyzes a transaction for potential threats
func (h *FirewallHandler) AnalyzeTransaction(c *gin.Context) {
	var tx models.Transaction
	if err := c.ShouldBindJSON(&tx); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Call AI service to analyze transaction
	risk, err := h.aiService.AnalyzeTransaction(tx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze transaction"})
		return
	}

	// Determine status based on risk score
	status := "safe"
	if risk > 0.7 {
		status = "blocked"
	} else if risk > 0.3 {
		status = "suspicious"
	}

	// Save transaction with risk score
	tx.Risk = risk
	tx.Status = status
	tx.Timestamp = time.Now()

	if err := h.db.Create(&tx).Error; err != nil {
		log.Printf("Failed to save transaction analysis: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    status,
		"riskScore": risk,
		"analysis":  tx,
	})
}

// AnalyzeHighValueTransaction analyzes a high-value transaction for additional security
func (h *FirewallHandler) AnalyzeHighValueTransaction(c *gin.Context) {
	var tx models.Transaction
	if err := c.ShouldBindJSON(&tx); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Call AI service to analyze high-value transaction with enhanced scrutiny
	risk, err := h.aiService.AnalyzeTransactionEnhanced(tx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze high-value transaction"})
		return
	}

	// For high-value transactions, we use stricter thresholds
	status := "safe"
	if risk > 0.5 { // Lower threshold for high-value transactions
		status = "blocked"
		log.Printf("🚨 HIGH VALUE TX BLOCKED - Amount: %v %s, To: %s, Risk Score: %.2f",
			tx.Value, tx.Currency, tx.ToAddress, risk)
	} else if risk > 0.2 { // Lower threshold for suspicious flag
		status = "suspicious"
		log.Printf("⚠️ Suspicious High Value TX - Amount: %v %s, To: %s, Risk Score: %.2f",
			tx.Value, tx.Currency, tx.ToAddress, risk)
	}

	// Save transaction with risk score
	tx.Risk = risk
	tx.Status = status
	tx.Timestamp = time.Now()

	if err := h.db.Create(&tx).Error; err != nil {
		log.Printf("Failed to save high-value transaction analysis: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    status,
		"riskScore": risk,
		"analysis":  tx,
	})
}

// GetStats returns transaction security statistics
func (h *FirewallHandler) GetStats(c *gin.Context) {
	var safeCount, suspiciousCount, blockedCount int64

	h.db.Model(&models.Transaction{}).Where("status = ?", "safe").Count(&safeCount)
	h.db.Model(&models.Transaction{}).Where("status = ?", "suspicious").Count(&suspiciousCount)
	h.db.Model(&models.Transaction{}).Where("status = ?", "blocked").Count(&blockedCount)

	c.JSON(http.StatusOK, gin.H{
		"safe":       safeCount,
		"suspicious": suspiciousCount,
		"blocked":    blockedCount,
		"total":      safeCount + suspiciousCount + blockedCount,
	})
}

// GetTransactions returns transaction history for a wallet address
func (h *FirewallHandler) GetTransactions(c *gin.Context) {
	// Get address from Web3 auth middleware
	address, exists := c.Get("address")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	walletAddress := address.(string)

	var transactions []models.Transaction
	result := h.db.Where("from_address = ? OR to_address = ?", walletAddress, walletAddress).
		Order("created_at DESC").
		Limit(50).
		Find(&transactions)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetAdminStats returns detailed statistics for admin dashboard
func (h *FirewallHandler) GetAdminStats(c *gin.Context) {
	// Get various statistics
	var stats struct {
		TotalTransactions       int64 `json:"totalTransactions"`
		BlockedTransactions     int64 `json:"blockedTransactions"`
		SuspiciousTransactions  int64 `json:"suspiciousTransactions"`
		SafeTransactions        int64 `json:"safeTransactions"`
		TotalReports            int64 `json:"totalReports"`
		VerifiedReports         int64 `json:"verifiedReports"`
		UniqueAddressesReported int64 `json:"uniqueAddressesReported"`
		LastDayTransactions     int64 `json:"lastDayTransactions"`
	}

	// Count different transaction types
	h.db.Model(&models.Transaction{}).Count(&stats.TotalTransactions)
	h.db.Model(&models.Transaction{}).Where("status = ?", "blocked").Count(&stats.BlockedTransactions)
	h.db.Model(&models.Transaction{}).Where("status = ?", "suspicious").Count(&stats.SuspiciousTransactions)
	h.db.Model(&models.Transaction{}).Where("status = ?", "safe").Count(&stats.SafeTransactions)

	// Count reports
	h.db.Model(&models.Report{}).Count(&stats.TotalReports)
	h.db.Model(&models.Report{}).Where("status = ?", "verified").Count(&stats.VerifiedReports)

	// Count unique reported addresses
	h.db.Model(&models.Report{}).Distinct("reported_address").Count(&stats.UniqueAddressesReported)

	// Count transactions in the last 24 hours
	yesterday := time.Now().Add(-24 * time.Hour)
	h.db.Model(&models.Transaction{}).Where("created_at > ?", yesterday).Count(&stats.LastDayTransactions)

	// Return all stats
	c.JSON(http.StatusOK, stats)
}
