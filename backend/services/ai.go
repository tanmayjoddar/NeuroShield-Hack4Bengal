package services

import (
	"Wallet/backend/models"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
)

// AIService provides machine learning model access for transaction analysis
type AIService struct {
	modelURL         string
	analyticsService *WalletAnalyticsService
	db               *gorm.DB
}

// NewAIService creates a new AI service instance
func NewAIService(analyticsService *WalletAnalyticsService) *AIService {
	// Always use the external ML API
	modelURL := "https://ml-fraud-transaction-detection.onrender.com/predict"

	return &AIService{
		modelURL:         modelURL,
		analyticsService: analyticsService,
	}
}

// NewAIServiceWithDB creates an AI service with direct database access for DAO queries
func NewAIServiceWithDB(analyticsService *WalletAnalyticsService, db *gorm.DB) *AIService {
	svc := NewAIService(analyticsService)
	svc.db = db
	return svc
}

// AIModelRequest represents the request structure for AI model prediction
type AIModelRequest struct {
	FromAddress           string    `json:"from_address"`
	ToAddress             string    `json:"to_address"`
	TransactionValue      float64   `json:"transaction_value"`
	GasPrice              float64   `json:"gas_price"`
	IsContractInteraction bool      `json:"is_contract_interaction"`
	AccHolder             string    `json:"acc_holder"`
	Features              []float64 `json:"features"`
}

// AIModelResponse represents the prediction response from the AI model
type AIModelResponse struct {
	Risk        float64            `json:"risk_score"`
	Explanation string             `json:"explanation"`
	Confidence  float64            `json:"confidence"`
	Features    map[string]float64 `json:"feature_importance"`
}

// AnalyzeTransaction calls the ML model + DAO scam database to analyze transaction risk.
// This is the backend side of the dual-layer flywheel:
//   ML prediction + DAO community-confirmed scam data = combined risk score.
func (s *AIService) AnalyzeTransaction(tx models.Transaction) (float64, error) {
	// Create a fixed array of 18 features as required by external ML API
	features := make([]float64, 18)

	// Populate known features
	features[13] = tx.Value  // Transaction value
	gasPrice := 20.0
	features[14] = gasPrice  // Gas price

	// Determine if this is a contract interaction
	isContract := false

	// Prepare request payload for external ML API
	request := AIModelRequest{
		FromAddress:           tx.FromAddress,
		ToAddress:             tx.ToAddress,
		TransactionValue:      tx.Value,
		GasPrice:              gasPrice,
		IsContractInteraction: isContract,
		AccHolder:             tx.FromAddress,
		Features:              features,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return 0, fmt.Errorf("error marshaling request: %w", err)
	}

	// Make HTTP request to ML model with timeout
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(s.modelURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, fmt.Errorf("error calling ML model: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("ML model returned non-OK status: %d", resp.StatusCode)
	}

	var externalResponse struct {
		Prediction string `json:"prediction"`
		Type       string `json:"Type"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&externalResponse); err != nil {
		return 0, fmt.Errorf("error decoding model response: %w", err)
	}

	// Convert ML prediction to risk score
	var mlRisk float64
	switch externalResponse.Prediction {
	case "Fraud":
		mlRisk = 0.85
	case "Suspicious":
		mlRisk = 0.50
	default:
		mlRisk = 0.10
	}

	// ══════════════════════════════════════════════════
	// FLYWHEEL: Boost risk with DAO-confirmed scam data
	// ══════════════════════════════════════════════════
	daoBoost := s.getDAOScamBoost(tx.ToAddress)

	// Combine: ML risk + DAO boost (capped at 1.0)
	combinedRisk := mlRisk + daoBoost
	if combinedRisk > 1.0 {
		combinedRisk = 1.0
	}

	return combinedRisk, nil
}

// getDAOScamBoost queries the DAO confirmed scam database and returns a risk boost.
// This is the core of the self-improving flywheel: community-curated data improves ML scoring.
func (s *AIService) getDAOScamBoost(address string) float64 {
	if s.db == nil {
		return 0
	}

	normAddr := strings.ToLower(address)

	// Check if address is a DAO-confirmed scam
	var confirmed models.ConfirmedScam
	if err := s.db.Where("address = ?", normAddr).First(&confirmed).Error; err == nil {
		// Confirmed scam: boost proportional to community confidence
		return float64(confirmed.ScamScore) / 100.0 * 0.5 // max +0.5 boost
	}

	// Check if address has active proposals (under review)
	var activeCount int64
	s.db.Model(&models.DAOProposal{}).
		Where("suspicious_address = ? AND status = ?", normAddr, "active").
		Count(&activeCount)

	if activeCount > 0 {
		return 0.15 // Under review gets a moderate boost
	}

	return 0
}

// AnalyzeTransactionEnhanced performs enhanced analysis for high-value transactions
func (s *AIService) AnalyzeTransactionEnhanced(tx models.Transaction) (float64, error) {
	// For enhanced analysis, we'll use both our base model and additional checks

	// First get base risk score
	baseRisk, err := s.AnalyzeTransaction(tx)
	if err != nil {
		return 0, fmt.Errorf("base analysis failed: %w", err)
	}

	// For high-value transactions, we do additional analysis
	enhancedRisk := baseRisk

	// Get historical analytics if available
	if s.analyticsService != nil {
		// Check if destination has been involved in scams
		scamHistory, err := s.analyticsService.GetAddressScamHistory(tx.ToAddress)
		if err == nil && scamHistory.ScamCount > 0 {
			enhancedRisk += 0.3 // Significant increase if destination has scam history
		}

		// Check for unusual transaction patterns
		isUnusual, err := s.analyticsService.IsUnusualTransaction(tx)
		if err == nil && isUnusual {
			enhancedRisk += 0.2 // Increase risk for unusual patterns
		}
	}

	// Cap the risk score at 1.0
	if enhancedRisk > 1.0 {
		enhancedRisk = 1.0
	}

	return enhancedRisk, nil
}

// GetRiskExplanation provides a human-readable explanation for a risk score
func (s *AIService) GetRiskExplanation(risk float64, tx models.Transaction) string {
	if risk > 0.7 {
		return "High risk transaction detected: This address has been associated with suspicious activity."
	} else if risk > 0.3 {
		return "Medium risk transaction: Exercise caution with this transaction."
	}
	return "Low risk transaction: No significant risk factors detected."
}

// IsAddressBlacklisted checks if an address is in the DAO-confirmed scam database.
// Replaces the old hardcoded list with real community-curated data.
func (s *AIService) IsAddressBlacklisted(address string) (bool, error) {
	if s.db == nil {
		return false, nil
	}

	normAddr := strings.ToLower(address)

	// Check DAO confirmed scams table
	var count int64
	err := s.db.Model(&models.ConfirmedScam{}).
		Where("address = ?", normAddr).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("failed to query scam database: %w", err)
	}

	if count > 0 {
		return true, nil
	}

	// Also check confirmed reports from the reporting system
	var reportCount int64
	s.db.Model(&models.Report{}).
		Where("scammer_address = ? AND status = ?", normAddr, "confirmed").
		Count(&reportCount)

	return reportCount > 0, nil
}
