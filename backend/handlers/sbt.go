package handlers

import (
	"Wallet/backend/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SBTHandler provides HTTP endpoints for Soulbound Token operations.
type SBTHandler struct {
	sbtService *services.SBTService
}

// NewSBTHandler creates a new SBT handler.
func NewSBTHandler(sbtService *services.SBTService) *SBTHandler {
	return &SBTHandler{sbtService: sbtService}
}

// GetSBTProfile returns the SBT profile for a wallet address.
// GET /api/sbt/profile/:address
func (h *SBTHandler) GetSBTProfile(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	record, err := h.sbtService.GetSBTProfile(address)
	if err != nil {
		// Check if it's a "no SBT" error vs actual failure
		hasSBT, checkErr := h.sbtService.HasSBT(address)
		if checkErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":  "Failed to check SBT status",
				"detail": checkErr.Error(),
			})
			return
		}
		if !hasSBT {
			c.JSON(http.StatusOK, gin.H{
				"hasSBT":  false,
				"address": address,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to read SBT profile",
			"detail": err.Error(),
		})
		return
	}

	breakdown := record.DecomposeTrustScore()

	c.JSON(http.StatusOK, gin.H{
		"hasSBT":  true,
		"address": address,
		"profile": gin.H{
			"tokenId":           record.TokenID,
			"verificationLevel": record.VerificationLevel,
			"trustScore":        record.TrustScore,
			"votingAccuracy":    record.VotingAccuracy,
			"doiParticipation":  record.DOIParticipation,
			"mintedAt":          record.MintedAt,
			"lastSyncedAt":      record.LastSyncedAt,
		},
		"breakdown": gin.H{
			"civicVerification":  breakdown.CivicVerification,
			"transactionHistory": breakdown.TransactionHistory,
			"votingAccuracy":     breakdown.VotingAccuracy,
			"daoParticipation":   breakdown.DAOParticipation,
			"total":              breakdown.Total,
		},
	})
}

// GetTrustBreakdown returns the decomposed trust score.
// GET /api/sbt/trust/:address
func (h *SBTHandler) GetTrustBreakdown(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	breakdown, err := h.sbtService.GetTrustBreakdown(address)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "No SBT found for this address",
			"address": address,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":   address,
		"breakdown": breakdown,
		"formula": gin.H{
			"civicVerification":  "+40 Are you a verified human?",
			"transactionHistory": "+20 Do you have transaction history?",
			"votingAccuracy":     "+20 Do you vote correctly in the DAO?",
			"daoParticipation":   "+20 Do you actually participate?",
			"total":              "= 100 Permanent on-chain reputation",
		},
	})
}

// CheckSBTStatus checks if an address has an SBT (on-chain check).
// GET /api/sbt/check/:address
func (h *SBTHandler) CheckSBTStatus(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	hasSBT, err := h.sbtService.HasSBT(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to check SBT status on-chain",
			"detail": err.Error(),
		})
		return
	}

	verified, _ := h.sbtService.IsVerified(address)

	c.JSON(http.StatusOK, gin.H{
		"address":    address,
		"hasSBT":     hasSBT,
		"isVerified": verified,
	})
}

// SyncSBT forces a re-sync of SBT data from chain.
// POST /api/sbt/sync/:address
func (h *SBTHandler) SyncSBT(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	if err := h.sbtService.SyncFromChain(address); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to sync from chain",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "SBT data synced from chain",
		"address": address,
	})
}

// GetLeaderboard returns the top SBT holders by trust score.
// GET /api/sbt/leaderboard?limit=20
func (h *SBTHandler) GetLeaderboard(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	records, err := h.sbtService.GetLeaderboard(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
		return
	}

	type LeaderboardEntry struct {
		Rank              int    `json:"rank"`
		WalletAddress     string `json:"walletAddress"`
		TrustScore        uint   `json:"trustScore"`
		VerificationLevel uint   `json:"verificationLevel"`
		VotingAccuracy    uint   `json:"votingAccuracy"`
		DOIParticipation  uint   `json:"doiParticipation"`
	}

	entries := make([]LeaderboardEntry, len(records))
	for i, r := range records {
		entries[i] = LeaderboardEntry{
			Rank:              i + 1,
			WalletAddress:     r.WalletAddress,
			TrustScore:        r.TrustScore,
			VerificationLevel: r.VerificationLevel,
			VotingAccuracy:    r.VotingAccuracy,
			DOIParticipation:  r.DOIParticipation,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"leaderboard": entries,
		"total":       len(entries),
	})
}

// GetSBTStats returns aggregate SBT statistics.
// GET /api/sbt/stats
func (h *SBTHandler) GetSBTStats(c *gin.Context) {
	stats, err := h.sbtService.GetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// ExportSBTData exports all SBT records as JSON.
// GET /api/sbt/export
func (h *SBTHandler) ExportSBTData(c *gin.Context) {
	data, err := h.sbtService.ExportSBTData()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export data"})
		return
	}

	c.Data(http.StatusOK, "application/json", data)
}
