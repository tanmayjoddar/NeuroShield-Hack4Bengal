package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"Wallet/backend/models"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

// SBTService reads CivicSBT contract data from Monad testnet and caches it in PostgreSQL.
type SBTService struct {
	DB              *gorm.DB
	rpcURL          string
	sbtAddress      common.Address
	verifierAddress common.Address
	sbtABI          abi.ABI
	verifierABI     abi.ABI
}

// Minimal ABIs — only the functions we call.
const civicSBTABIJSON = `[
  {"inputs":[{"name":"owner","type":"address"}],"name":"hasSBT","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"owner","type":"address"}],"name":"getTokenMetadata","outputs":[{"components":[{"name":"issuedAt","type":"uint256"},{"name":"verificationLevel","type":"uint256"},{"name":"trustScore","type":"uint256"},{"name":"votingAccuracy","type":"uint256"},{"name":"doiParticipation","type":"uint256"}],"name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"to","type":"address"},{"indexed":true,"name":"tokenId","type":"uint256"}],"name":"SBTMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"tokenId","type":"uint256"},{"indexed":false,"name":"newUri","type":"string"}],"name":"MetadataUpdated","type":"event"}
]`

const civicVerifierABIJSON = `[
  {"inputs":[{"name":"_userAddress","type":"address"}],"name":"isVerified","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"_userAddress","type":"address"}],"name":"getVerificationLevel","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"_userAddress","type":"address"}],"name":"getUserVerification","outputs":[{"components":[{"name":"isVerified","type":"bool"},{"name":"verificationLevel","type":"uint256"},{"name":"timestamp","type":"uint256"},{"name":"trustScore","type":"uint256"},{"name":"votingAccuracy","type":"uint256"},{"name":"doiParticipation","type":"uint256"}],"name":"","type":"tuple"}],"stateMutability":"view","type":"function"}
]`

// NewSBTService creates the SBT service.
// Reads contract addresses from environment.
func NewSBTService(db *gorm.DB) (*SBTService, error) {
	rpcURL := os.Getenv("MONAD_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet-rpc.monad.xyz"
	}

	sbtAddr := os.Getenv("CIVIC_SBT_ADDRESS")
	verifierAddr := os.Getenv("CIVIC_VERIFIER_ADDRESS")

	if sbtAddr == "" || verifierAddr == "" {
		return nil, fmt.Errorf("CIVIC_SBT_ADDRESS and CIVIC_VERIFIER_ADDRESS must be set")
	}

	parsedSBT, err := abi.JSON(strings.NewReader(civicSBTABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse CivicSBT ABI: %w", err)
	}

	parsedVerifier, err := abi.JSON(strings.NewReader(civicVerifierABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse CivicVerifier ABI: %w", err)
	}

	// Auto-migrate SBT tables
	if err := db.AutoMigrate(&models.SBTRecord{}, &models.SBTMintEvent{}, &models.SBTUpdateEvent{}); err != nil {
		log.Printf("[SBT] Warning: auto-migrate failed: %v", err)
	}

	return &SBTService{
		DB:              db,
		rpcURL:          rpcURL,
		sbtAddress:      common.HexToAddress(sbtAddr),
		verifierAddress: common.HexToAddress(verifierAddr),
		sbtABI:          parsedSBT,
		verifierABI:     parsedVerifier,
	}, nil
}

// ════════════════════════════════════════════
// READ: On-Chain Data
// ════════════════════════════════════════════

// HasSBT checks if an address has a Soulbound Token on-chain.
func (s *SBTService) HasSBT(address string) (bool, error) {
	client, err := ethclient.Dial(s.rpcURL)
	if err != nil {
		return false, fmt.Errorf("RPC dial failed: %w", err)
	}
	defer client.Close()

	addr := common.HexToAddress(address)
	callData, err := s.sbtABI.Pack("hasSBT", addr)
	if err != nil {
		return false, fmt.Errorf("pack failed: %w", err)
	}

	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &s.sbtAddress,
		Data: callData,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("call failed: %w", err)
	}

	var has bool
	if err := s.sbtABI.UnpackIntoInterface(&has, "hasSBT", result); err != nil {
		return false, fmt.Errorf("unpack failed: %w", err)
	}
	return has, nil
}

// GetOnChainMetadata reads the full SBT metadata from the contract.
func (s *SBTService) GetOnChainMetadata(address string) (*models.SBTRecord, error) {
	client, err := ethclient.Dial(s.rpcURL)
	if err != nil {
		return nil, fmt.Errorf("RPC dial failed: %w", err)
	}
	defer client.Close()

	addr := common.HexToAddress(address)

	// Check if user has SBT first
	has, err := s.HasSBT(address)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, fmt.Errorf("address %s has no SBT", address)
	}

	// Call getTokenMetadata(address)
	callData, err := s.sbtABI.Pack("getTokenMetadata", addr)
	if err != nil {
		return nil, fmt.Errorf("pack getTokenMetadata failed: %w", err)
	}

	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &s.sbtAddress,
		Data: callData,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call getTokenMetadata failed: %w", err)
	}

	// Unpack the tuple
	unpacked, err := s.sbtABI.Unpack("getTokenMetadata", result)
	if err != nil {
		return nil, fmt.Errorf("unpack getTokenMetadata failed: %w", err)
	}

	if len(unpacked) == 0 {
		return nil, fmt.Errorf("empty result from getTokenMetadata")
	}

	// The result is a struct — ABI unpacks it as an anonymous struct
	type TokenMeta struct {
		IssuedAt          *big.Int
		VerificationLevel *big.Int
		TrustScore        *big.Int
		VotingAccuracy    *big.Int
		DoiParticipation  *big.Int
	}

	// Try to extract from the first element (which should be the struct)
	raw, ok := unpacked[0].(struct {
		IssuedAt          *big.Int `abi:"issuedAt"`
		VerificationLevel *big.Int `abi:"verificationLevel"`
		TrustScore        *big.Int `abi:"trustScore"`
		VotingAccuracy    *big.Int `abi:"votingAccuracy"`
		DoiParticipation  *big.Int `abi:"doiParticipation"`
	})
	if !ok {
		return nil, fmt.Errorf("unexpected type from getTokenMetadata unpack")
	}

	mintedAt := time.Unix(raw.IssuedAt.Int64(), 0)

	record := &models.SBTRecord{
		WalletAddress:     strings.ToLower(address),
		VerificationLevel: uint(raw.VerificationLevel.Uint64()),
		TrustScore:        uint(raw.TrustScore.Uint64()),
		VotingAccuracy:    uint(raw.VotingAccuracy.Uint64()),
		DOIParticipation:  uint(raw.DoiParticipation.Uint64()),
		MintedAt:          mintedAt,
		LastSyncedAt:      time.Now(),
	}

	return record, nil
}

// ════════════════════════════════════════════
// CACHE: Read & Sync
// ════════════════════════════════════════════

// GetSBTProfile returns the cached SBT record, refreshing from chain if stale (>5 min).
func (s *SBTService) GetSBTProfile(address string) (*models.SBTRecord, error) {
	normalized := strings.ToLower(address)

	// Check cache first
	var cached models.SBTRecord
	err := s.DB.Where("wallet_address = ?", normalized).First(&cached).Error
	if err == nil {
		// Cache hit — refresh if stale (> 5 minutes)
		if time.Since(cached.LastSyncedAt) > 5*time.Minute {
			go func() {
				if err := s.SyncFromChain(address); err != nil {
					log.Printf("[SBT] Background sync failed for %s: %v", address, err)
				}
			}()
		}
		return &cached, nil
	}

	// Cache miss — read from chain
	record, err := s.GetOnChainMetadata(address)
	if err != nil {
		return nil, err
	}

	// Save to cache
	if err := s.DB.Create(record).Error; err != nil {
		// Might be a race — try update
		s.DB.Where("wallet_address = ?", normalized).Updates(record)
	}

	return record, nil
}

// SyncFromChain reads the latest on-chain data and updates the DB cache.
func (s *SBTService) SyncFromChain(address string) error {
	record, err := s.GetOnChainMetadata(address)
	if err != nil {
		return err
	}

	normalized := strings.ToLower(address)
	result := s.DB.Where("wallet_address = ?", normalized).Updates(map[string]interface{}{
		"verification_level": record.VerificationLevel,
		"trust_score":        record.TrustScore,
		"voting_accuracy":    record.VotingAccuracy,
		"doi_participation":  record.DOIParticipation,
		"last_synced_at":     time.Now(),
	})
	if result.RowsAffected == 0 {
		return s.DB.Create(record).Error
	}
	return result.Error
}

// GetTrustBreakdown returns the decomposed trust score for an address.
func (s *SBTService) GetTrustBreakdown(address string) (*models.TrustScoreBreakdown, error) {
	record, err := s.GetSBTProfile(address)
	if err != nil {
		return nil, err
	}
	breakdown := record.DecomposeTrustScore()
	return &breakdown, nil
}

// ════════════════════════════════════════════
// VERIFICATION STATUS
// ════════════════════════════════════════════

// IsVerified checks on-chain CivicVerifier.isVerified(address).
func (s *SBTService) IsVerified(address string) (bool, error) {
	client, err := ethclient.Dial(s.rpcURL)
	if err != nil {
		return false, fmt.Errorf("RPC dial failed: %w", err)
	}
	defer client.Close()

	addr := common.HexToAddress(address)
	callData, err := s.verifierABI.Pack("isVerified", addr)
	if err != nil {
		return false, fmt.Errorf("pack failed: %w", err)
	}

	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &s.verifierAddress,
		Data: callData,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("call failed: %w", err)
	}

	var verified bool
	if err := s.verifierABI.UnpackIntoInterface(&verified, "isVerified", result); err != nil {
		return false, fmt.Errorf("unpack failed: %w", err)
	}
	return verified, nil
}

// ════════════════════════════════════════════
// EVENT PROCESSING
// ════════════════════════════════════════════

var sbtMintedTopic = crypto.Keccak256Hash([]byte("SBTMinted(address,uint256)"))
var metadataUpdatedTopic = crypto.Keccak256Hash([]byte("MetadataUpdated(uint256,string)"))

// ProcessSBTMintedLog handles an SBTMinted event log.
func (s *SBTService) ProcessSBTMintedLog(logEntry *LogEntry) error {
	if len(logEntry.Topics) < 3 {
		return fmt.Errorf("SBTMinted event requires 3 topics (event, to, tokenId)")
	}

	toAddr := common.HexToAddress(logEntry.Topics[1])
	tokenID := new(big.Int).SetBytes(common.FromHex(logEntry.Topics[2]))

	log.Printf("[SBT] SBTMinted: to=%s tokenId=%d tx=%s", toAddr.Hex(), tokenID, logEntry.TxHash)

	// Record the event
	mintEvent := &models.SBTMintEvent{
		WalletAddress: strings.ToLower(toAddr.Hex()),
		TokenID:       tokenID.Uint64(),
		TxHash:        logEntry.TxHash,
		BlockNumber:   logEntry.BlockNumber,
	}
	if err := s.DB.Create(mintEvent).Error; err != nil {
		log.Printf("[SBT] Failed to save mint event: %v", err)
	}

	// Sync the full metadata from chain
	return s.SyncFromChain(toAddr.Hex())
}

// LogEntry is a simplified log structure for event processing.
type LogEntry struct {
	Topics      []string
	Data        string
	TxHash      string
	BlockNumber uint64
}

// ProcessMetadataUpdatedLog handles a MetadataUpdated event log.
func (s *SBTService) ProcessMetadataUpdatedLog(logEntry *LogEntry) error {
	if len(logEntry.Topics) < 2 {
		return fmt.Errorf("MetadataUpdated event requires 2 topics (event, tokenId)")
	}

	tokenID := new(big.Int).SetBytes(common.FromHex(logEntry.Topics[1]))

	log.Printf("[SBT] MetadataUpdated: tokenId=%d tx=%s", tokenID, logEntry.TxHash)

	// Record the event
	updateEvent := &models.SBTUpdateEvent{
		TokenID:     tokenID.Uint64(),
		NewURI:      logEntry.Data,
		TxHash:      logEntry.TxHash,
		BlockNumber: logEntry.BlockNumber,
	}
	if err := s.DB.Create(updateEvent).Error; err != nil {
		log.Printf("[SBT] Failed to save update event: %v", err)
	}

	return nil
}

// ════════════════════════════════════════════
// QUERY: Leaderboard & Stats
// ════════════════════════════════════════════

// GetLeaderboard returns the top N SBT holders by trust score.
func (s *SBTService) GetLeaderboard(limit int) ([]models.SBTRecord, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var records []models.SBTRecord
	err := s.DB.Order("trust_score DESC").Limit(limit).Find(&records).Error
	return records, err
}

// GetStats returns aggregate SBT statistics.
func (s *SBTService) GetStats() (map[string]interface{}, error) {
	var totalMinted int64
	s.DB.Model(&models.SBTRecord{}).Count(&totalMinted)

	var avgTrustScore float64
	s.DB.Model(&models.SBTRecord{}).Select("COALESCE(AVG(trust_score), 0)").Scan(&avgTrustScore)

	var premiumCount int64
	s.DB.Model(&models.SBTRecord{}).Where("verification_level = ?", 3).Count(&premiumCount)

	var totalEvents int64
	s.DB.Model(&models.SBTMintEvent{}).Count(&totalEvents)

	stats := map[string]interface{}{
		"totalMinted":       totalMinted,
		"avgTrustScore":     fmt.Sprintf("%.1f", avgTrustScore),
		"premiumHolders":    premiumCount,
		"totalMintEvents":   totalEvents,
	}

	return stats, nil
}

// ExportSBTData exports all SBT records as JSON for analytics.
func (s *SBTService) ExportSBTData() ([]byte, error) {
	var records []models.SBTRecord
	if err := s.DB.Find(&records).Error; err != nil {
		return nil, err
	}

	type ExportRecord struct {
		WalletAddress     string                    `json:"walletAddress"`
		TrustScore        uint                      `json:"trustScore"`
		VerificationLevel uint                      `json:"verificationLevel"`
		Breakdown         models.TrustScoreBreakdown `json:"breakdown"`
		MintedAt          time.Time                  `json:"mintedAt"`
	}

	exports := make([]ExportRecord, len(records))
	for i, r := range records {
		exports[i] = ExportRecord{
			WalletAddress:     r.WalletAddress,
			TrustScore:        r.TrustScore,
			VerificationLevel: r.VerificationLevel,
			Breakdown:         r.DecomposeTrustScore(),
			MintedAt:          r.MintedAt,
		}
	}

	return json.Marshal(exports)
}
