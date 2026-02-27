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

// ReportHandler handles scam report endpoints
type ReportHandler struct {
	db                *gorm.DB
	blockchainService *services.BlockchainService
}

// NewReportHandler creates a new report handler
func NewReportHandler(db *gorm.DB, blockchainService *services.BlockchainService) *ReportHandler {
	return &ReportHandler{
		db:                db,
		blockchainService: blockchainService,
	}
}

// CreateReport creates a new scam report
func (h *ReportHandler) CreateReport(c *gin.Context) {
	var report models.Report
	if err := c.ShouldBindJSON(&report); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report format"})
		return
	}

	// Get reporter address from Web3 auth middleware
	address, exists := c.Get("address")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Set reporter address and default values
	report.ReporterAddress = address.(string)
	report.CreatedAt = time.Now()
	report.Status = "pending"

	// Submit report to blockchain
	txHash, err := h.blockchainService.ReportScamOnChain(
		report.ReportedAddress,
		report.ReporterAddress,
		report.Description,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit report to blockchain: " + err.Error()})
		return
	}

	// Store transaction hash in report
	report.TxHash = txHash

	// Save report to database
	if err := h.db.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save report: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      report.ID,
		"message": "Report submitted successfully",
		"txHash":  txHash,
	})
}

// CreateCriticalReport creates a high-priority scam report with immediate blockchain submission
func (h *ReportHandler) CreateCriticalReport(c *gin.Context) {
	var report models.Report
	if err := c.ShouldBindJSON(&report); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report format"})
		return
	}

	// Get reporter address from Web3 auth middleware
	address, exists := c.Get("address")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Set critical report specific fields
	report.ReporterAddress = address.(string)
	report.CreatedAt = time.Now()
	report.Status = "critical"
	report.Priority = "high"
	report.RequiresImmediate = true

	// Save report to database first
	if err := h.db.Create(&report).Error; err != nil {
		log.Printf("Failed to save critical report: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save report"})
		return
	}

	// Submit to blockchain immediately (non-critical reports might be batched)
	if h.blockchainService != nil {
		go func() {
			txHash, err := h.blockchainService.SubmitReport(report)
			if err != nil {
				log.Printf("Failed to submit critical report to blockchain: %v", err)
				// Update report status in database
				h.db.Model(&report).Updates(map[string]interface{}{
					"status": "blockchain_failed",
					"error":  err.Error(),
				})
				log.Printf("❌ Critical Report Blockchain Submission Failed - Report ID: %d, Error: %v",
					report.ID, err)
				return
			}

			// Update report with transaction hash
			h.db.Model(&report).Updates(map[string]interface{}{
				"blockchain_tx": txHash,
				"status":       "blockchain_pending",
			})

			log.Printf("🚨 Critical Report Submitted - Report ID: %d, Tx Hash: %s",
				report.ID, txHash)
		}()
	}

	log.Printf("🚨 New Critical Report - Scammer: %s, Amount: %v, Type: %s",
		report.ScammerAddress, report.Amount, report.ScamType)

	c.JSON(http.StatusOK, gin.H{
		"message": "Critical report submitted",
		"report":  report,
	})
}

// GetReports retrieves reports for the authenticated user
func (h *ReportHandler) GetReports(c *gin.Context) {
	// Get address from Web3 auth middleware
	address, exists := c.Get("address")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	var reports []models.Report
	result := h.db.Where("reporter_address = ?", address).Find(&reports)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}

	c.JSON(http.StatusOK, reports)
}

// GetAllReports retrieves all reports (admin only)
func (h *ReportHandler) GetAllReports(c *gin.Context) {
	var reports []models.Report
	result := h.db.Find(&reports)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}

	c.JSON(http.StatusOK, reports)
}

// VerifyReport verifies a report and updates its status (admin only)
func (h *ReportHandler) VerifyReport(c *gin.Context) {
	id := c.Param("id")

	var report models.Report
	if result := h.db.First(&report, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	var input struct {
		Status   string `json:"status" binding:"required,oneof=verified rejected"`
		Severity int    `json:"severity"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Update report
	report.Status = input.Status
	if input.Severity > 0 {
		report.Severity = input.Severity
	}

	if err := h.db.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update report"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Report status updated",
		"report":  report,
	})
}

// InitiateRecovery starts the asset recovery process for a scam
func (h *ReportHandler) InitiateRecovery(c *gin.Context) {
	var request struct {
		VictimAddress  string `json:"victimAddress" binding:"required"`
		ScammerAddress string `json:"scammerAddress" binding:"required"`
		Evidence       string `json:"evidence" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Get requester address from Web3 auth middleware
	address, exists := c.Get("address")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Check if the requester is the victim
	if address.(string) != request.VictimAddress {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the victim can initiate recovery"})
		return
	}

	// Trigger asset recovery on blockchain
	txHash, err := h.blockchainService.TriggerAssetRecovery(
		request.VictimAddress,
		request.ScammerAddress,
		request.Evidence,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate recovery: " + err.Error()})
		return
	}

	// Create a record in the database
	recovery := models.Recovery{
		VictimAddress:  request.VictimAddress,
		ScammerAddress: request.ScammerAddress,
		TxHash:         txHash,
		Status:         "pending",
		CreatedAt:      time.Now(),
		Evidence:       request.Evidence,
	}

	if err := h.db.Create(&recovery).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recovery record"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Recovery process initiated",
		"txHash":  txHash,
	})
}

// CheckRecoveryStatus checks the status of a recovery process
func (h *ReportHandler) CheckRecoveryStatus(c *gin.Context) {
	txHash := c.Param("txHash")

	var recovery models.Recovery
	if result := h.db.Where("tx_hash = ?", txHash).First(&recovery); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recovery record not found"})
		return
	}

	// Check blockchain status
	status, err := h.blockchainService.GetTransactionStatus(txHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check transaction status"})
		return
	}

	// Update status if needed
	if recovery.Status != status {
		recovery.Status = status
		h.db.Save(&recovery)
	}

	c.JSON(http.StatusOK, gin.H{
		"recovery": recovery,
		"status":   status,
	})
}
