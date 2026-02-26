package models

import (
	"time"

	"gorm.io/gorm"
)

// SBTRecord caches on-chain SBT data in PostgreSQL for fast API reads.
// Authoritative source is always the CivicSBT smart contract on Monad.
// This table is updated by the SBT service whenever it reads or receives events.
type SBTRecord struct {
	gorm.Model
	WalletAddress     string    `gorm:"uniqueIndex;not null" json:"walletAddress"`
	TokenID           uint64    `gorm:"not null" json:"tokenId"`
	VerificationLevel uint      `gorm:"not null;default:0" json:"verificationLevel"` // 1=Basic, 2=Advanced, 3=Premium
	TrustScore        uint      `gorm:"not null;default:0" json:"trustScore"`         // 0-100
	VotingAccuracy    uint      `gorm:"not null;default:0" json:"votingAccuracy"`     // 0-100
	DOIParticipation  uint      `gorm:"not null;default:0" json:"doiParticipation"`   // Total DAO votes
	MintedAt          time.Time `gorm:"not null" json:"mintedAt"`                     // Block timestamp of mint
	LastSyncedAt      time.Time `gorm:"not null" json:"lastSyncedAt"`                 // Last time we read from chain
	TxHash            string    `gorm:"index" json:"txHash"`                          // Mint or last update tx hash
	BlockNumber       uint64    `gorm:"not null;default:0" json:"blockNumber"`
}

// SBTMintEvent records every SBTMinted event from the chain for audit trail.
type SBTMintEvent struct {
	gorm.Model
	WalletAddress string `gorm:"index;not null" json:"walletAddress"`
	TokenID       uint64 `gorm:"not null" json:"tokenId"`
	TxHash        string `gorm:"uniqueIndex;not null" json:"txHash"`
	BlockNumber   uint64 `gorm:"not null" json:"blockNumber"`
}

// SBTUpdateEvent records every MetadataUpdated event from the chain.
type SBTUpdateEvent struct {
	gorm.Model
	TokenID     uint64 `gorm:"index;not null" json:"tokenId"`
	NewURI      string `gorm:"type:text" json:"newUri"`
	TxHash      string `gorm:"uniqueIndex;not null" json:"txHash"`
	BlockNumber uint64 `gorm:"not null" json:"blockNumber"`
}

// TrustScoreBreakdown is not stored — it's computed on read.
type TrustScoreBreakdown struct {
	CivicVerification  uint `json:"civicVerification"`  // max 40
	TransactionHistory uint `json:"transactionHistory"` // max 20
	VotingAccuracy     uint `json:"votingAccuracy"`     // max 20
	DAOParticipation   uint `json:"daoParticipation"`   // max 20
	Total              uint `json:"total"`              // max 100
}

// DecomposeTrustScore breaks down the stored trust score into its 4 components.
func (r *SBTRecord) DecomposeTrustScore() TrustScoreBreakdown {
	civic := uint(0)
	if r.VerificationLevel > 0 {
		civic = 40
	}
	accuracy := r.VotingAccuracy / 5 // floor(votingAccuracy * 0.2)
	if accuracy > 20 {
		accuracy = 20
	}
	participation := r.DOIParticipation * 2
	if participation > 20 {
		participation = 20
	}
	txHistory := uint(0)
	if r.TrustScore > civic+accuracy+participation {
		txHistory = r.TrustScore - civic - accuracy - participation
	}
	if txHistory > 20 {
		txHistory = 20
	}

	return TrustScoreBreakdown{
		CivicVerification:  civic,
		TransactionHistory: txHistory,
		VotingAccuracy:     accuracy,
		DAOParticipation:   participation,
		Total:              r.TrustScore,
	}
}
