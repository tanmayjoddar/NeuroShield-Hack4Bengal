package handlers

import (
	"Wallet/backend/models"
	"Wallet/backend/services"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SCAM_THRESHOLD is the percentage of "for" votes required to confirm a scam (matching contract)
const SCAM_THRESHOLD = 60

// DAOHandler handles DAO voting endpoints
type DAOHandler struct {
	db                *gorm.DB
	blockchainService *services.BlockchainService
}

// NewDAOHandler creates a new DAO handler
func NewDAOHandler(db *gorm.DB, blockchainService *services.BlockchainService) *DAOHandler {
	return &DAOHandler{
		db:                db,
		blockchainService: blockchainService,
	}
}

// CastVote records a DAO vote for a proposal
func (h *DAOHandler) CastVote(c *gin.Context) {
	var vote models.DAOVote
	if err := c.ShouldBindJSON(&vote); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vote format"})
		return
	}

	// Validate vote type - only "for" or "against" allowed
	if vote.VoteType != "for" && vote.VoteType != "against" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VoteType must be 'for' or 'against'"})
		return
	}

	// Validate voter address
	if vote.VoterAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VoterAddress is required"})
		return
	}

	// Normalize address to lowercase
	vote.VoterAddress = strings.ToLower(vote.VoterAddress)

	// Set timestamp
	vote.VotedAt = time.Now()

	// Use a database transaction for atomicity
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Check if proposal exists and is still active
		var proposal models.DAOProposal
		if result := tx.First(&proposal, vote.ProposalID); result.Error != nil {
			return result.Error
		}

		if proposal.Status != "active" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Proposal is no longer active"})
			return nil
		}

		if time.Now().After(proposal.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Voting period has ended"})
			return nil
		}

		// Check if user already voted
		var count int64
		tx.Model(&models.DAOVote{}).Where("proposal_id = ? AND voter_address = ?", vote.ProposalID, vote.VoterAddress).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "You have already voted on this proposal"})
			return nil
		}

		// Save vote
		if err := tx.Create(&vote).Error; err != nil {
			return err
		}

		// Atomic update of vote counts using SQL increment
		if vote.VoteType == "for" {
			tx.Model(&proposal).Update("votes_for", gorm.Expr("votes_for + ?", 1))
		} else {
			tx.Model(&proposal).Update("votes_against", gorm.Expr("votes_against + ?", 1))
		}

		// Reload updated proposal
		tx.First(&proposal, vote.ProposalID)

		// Auto-execute: if enough votes confirm the scam, mark it
		totalVotes := proposal.VotesFor + proposal.VotesAgainst
		if totalVotes >= 3 { // Minimum quorum of 3 votes
			forPercent := (proposal.VotesFor * 100) / totalVotes
			if forPercent >= SCAM_THRESHOLD && proposal.Status == "active" {
				proposal.Status = "passed"
				tx.Save(&proposal)

				// Record in confirmed scams table (flywheel output)
				confirmedScam := models.ConfirmedScam{
					Address:     strings.ToLower(proposal.SuspiciousAddress),
					ScamScore:   forPercent,
					ProposalID:  proposal.ID,
					ConfirmedAt: time.Now(),
					TotalVoters: totalVotes,
					Description: proposal.Description,
				}
				tx.Where("address = ?", confirmedScam.Address).
					Assign(confirmedScam).
					FirstOrCreate(&confirmedScam)
			} else if (proposal.VotesAgainst*100)/totalVotes > (100-SCAM_THRESHOLD) && proposal.Status == "active" {
				// Community cleared this address
				proposal.Status = "rejected"
				tx.Save(&proposal)
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"message":  "Vote recorded successfully",
			"proposal": proposal,
		})
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process vote: " + err.Error()})
	}
}

// GetProposals retrieves all active DAO proposals
func (h *DAOHandler) GetProposals(c *gin.Context) {
	var proposals []models.DAOProposal

	// Optional filter by status
	status := c.Query("status")
	query := h.db
	if status != "" {
		query = query.Where("status = ?", status)
	}

	result := query.Order("created_at DESC").Find(&proposals)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch proposals"})
		return
	}

	c.JSON(http.StatusOK, proposals)
}

// CreateProposal creates a new DAO proposal
func (h *DAOHandler) CreateProposal(c *gin.Context) {
	var proposal models.DAOProposal
	if err := c.ShouldBindJSON(&proposal); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proposal format"})
		return
	}

	// Validate suspicious address is provided
	if proposal.SuspiciousAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SuspiciousAddress is required"})
		return
	}

	// Normalize addresses
	proposal.SuspiciousAddress = strings.ToLower(proposal.SuspiciousAddress)
	if proposal.CreatorAddress != "" {
		proposal.CreatorAddress = strings.ToLower(proposal.CreatorAddress)
	}

	// Set default values
	proposal.CreatedAt = time.Now()
	proposal.Status = "active"
	proposal.VotesFor = 0
	proposal.VotesAgainst = 0
	proposal.EndTime = time.Now().AddDate(0, 0, 7) // 7 days from now

	// Save proposal to database
	if err := h.db.Create(&proposal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proposal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      proposal.ID,
		"message": "Proposal created successfully",
	})
}

// GetScamScore returns the DAO community scam score for an address (flywheel endpoint)
func (h *DAOHandler) GetScamScore(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))

	// Check confirmed scams table first
	var confirmed models.ConfirmedScam
	if err := h.db.Where("address = ?", address).First(&confirmed).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"address":    address,
			"isScam":     true,
			"scamScore":  confirmed.ScamScore,
			"confirmedAt": confirmed.ConfirmedAt,
			"voters":     confirmed.TotalVoters,
			"source":     "dao_confirmed",
		})
		return
	}

	// Check active proposals for this address
	var activeCount int64
	h.db.Model(&models.DAOProposal{}).
		Where("suspicious_address = ? AND status = ?", address, "active").
		Count(&activeCount)

	if activeCount > 0 {
		c.JSON(http.StatusOK, gin.H{
			"address":         address,
			"isScam":          false,
			"scamScore":       30, // Under review gets a base score
			"activeProposals": activeCount,
			"source":          "under_review",
		})
		return
	}

	// Not in our database
	c.JSON(http.StatusOK, gin.H{
		"address":   address,
		"isScam":    false,
		"scamScore": 0,
		"source":    "unknown",
	})
}

// GetAddressStatus returns whether an address is a DAO-confirmed scam
func (h *DAOHandler) GetAddressStatus(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))

	var confirmed models.ConfirmedScam
	isScam := h.db.Where("address = ?", address).First(&confirmed).Error == nil

	c.JSON(http.StatusOK, gin.H{
		"address": address,
		"isScam":  isScam,
	})
}
