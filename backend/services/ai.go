package services

import (
	"Wallet/backend/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
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
// Features is []interface{} because positions 16 & 17 are strings.
type AIModelRequest struct {
	FromAddress           string        `json:"from_address"`
	ToAddress             string        `json:"to_address"`
	TransactionValue      float64       `json:"transaction_value"`
	GasPrice              float64       `json:"gas_price"`
	IsContractInteraction bool          `json:"is_contract_interaction"`
	AccHolder             string        `json:"acc_holder"`
	Features              []interface{} `json:"features"`
}

// AIModelResponse represents the prediction response from the AI model
type AIModelResponse struct {
	Risk        float64            `json:"risk_score"`
	Explanation string             `json:"explanation"`
	Confidence  float64            `json:"confidence"`
	Features    map[string]float64 `json:"feature_importance"`
}

// AnalyzeTransaction calls the deployed Render ML API + DAO scam database.
// We own ZERO ml code — the model lives at ml-fraud-transaction-detection.onrender.com.
// Our job: send the best possible 18-feature payload, then layer DAO data on top.
func (s *AIService) AnalyzeTransaction(tx models.Transaction) (float64, error) {
	// ──────────────────────────────────────────────────
	// Build the 18-feature vector the deployed model expects.
	// Feature positions (from the model's training dataset):
	//  [0]  avg_min_between_sent_tnx      (float)
	//  [1]  avg_min_between_received_tnx  (float)
	//  [2]  time_diff_mins                (float)
	//  [3]  sent_tnx                      (float)
	//  [4]  received_tnx                  (float)
	//  [5]  number_of_created_contracts   (float)
	//  [6]  max_value_received            (float)
	//  [7]  avg_val_received              (float)
	//  [8]  avg_val_sent                  (float)
	//  [9]  total_ether_sent              (float)
	//  [10] total_ether_balance           (float)
	//  [11] erc20_total_ether_received    (float)
	//  [12] erc20_total_ether_sent        (float)
	//  [13] erc20_total_ether_sent_contract (float)
	//  [14] erc20_uniq_sent_addr          (float)
	//  [15] erc20_uniq_rec_token_name     (float)
	//  [16] erc20_most_sent_token_type    (str)
	//  [17] erc20_most_rec_token_type     (str)
	// ──────────────────────────────────────────────────
	features := make([]interface{}, 18)
	for i := 0; i < 16; i++ {
		features[i] = 0.0
	}
	features[16] = "" // erc20_most_sent_token_type (string)
	features[17] = "" // erc20_most_rec_token_type (string)
	features[9] = tx.Value // total_ether_sent (current tx as proxy)
	isContract := false

	// Populate the rest from wallet analytics (DB + RPC data we already collect).
	// This is NOT adding ML code — it's filling the request with real data
	// instead of sending 16 zeros to the deployed model.
	// Analyze the RECIPIENT's wallet — that's who we're evaluating for fraud.
	if s.analyticsService != nil {
		if wa, err := s.analyticsService.GetWalletAnalytics(tx.ToAddress); err == nil && wa != nil {
			features[0] = wa.AvgMinBetweenSentTx
			features[1] = wa.AvgMinBetweenReceivedTx
			features[2] = wa.TimeDiffFirstLastMins
			features[3] = float64(wa.SentTxCount)
			features[4] = float64(wa.ReceivedTxCount)
			features[5] = float64(wa.CreatedContractsCount)
			features[6] = weiToEth(wa.MaxValueReceived)
			features[7] = weiToEth(wa.AvgValueReceived)
			features[8] = weiToEth(wa.AvgValueSent)
			features[9] = weiToEth(wa.TotalEtherSent)
			features[10] = weiToEth(wa.TotalEtherBalance)
			features[11] = weiToEth(wa.ERC20TotalEtherReceived)
			features[12] = weiToEth(wa.ERC20TotalEtherSent)
			features[13] = weiToEth(wa.ERC20TotalEtherSentContract)
			features[14] = float64(wa.ERC20UniqSentAddr)
			features[15] = float64(wa.ERC20UniqRecTokenName)
			features[16] = wa.ERC20MostSentTokenType
			features[17] = wa.ERC20MostRecTokenType
		}
		// If analytics fails we still have [9] (tx value) — same as before, no worse.
	}

	request := AIModelRequest{
		FromAddress:           tx.FromAddress,
		ToAddress:             tx.ToAddress,
		TransactionValue:      tx.Value,
		GasPrice:              20.0, // default gas price for metadata
		IsContractInteraction: isContract,
		AccHolder:             tx.ToAddress, // Evaluate the RECIPIENT address
		Features:              features,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return 0, fmt.Errorf("error marshaling request: %w", err)
	}

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
	combinedRisk := mlRisk + daoBoost
	if combinedRisk > 1.0 {
		combinedRisk = 1.0
	}

	return combinedRisk, nil
}

// weiToEth converts a big.Int string (Wei) to float64 ETH. Returns 0 on error.
func weiToEth(s string) float64 {
	if s == "" || s == "0" {
		return 0
	}
	f, ok := new(big.Float).SetString(s)
	if !ok {
		return 0
	}
	eth, _ := new(big.Float).Quo(f, new(big.Float).SetFloat64(1e18)).Float64()
	return eth
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
