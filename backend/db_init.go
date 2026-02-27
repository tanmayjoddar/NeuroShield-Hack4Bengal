package main

import (
	"Wallet/backend/models"
	"log"
	"time"

	"gorm.io/gorm"
)

// InitializeDatabase sets up the database schema and creates any required tables
func InitializeDatabase(db *gorm.DB) error {
	log.Println("Running database migrations...")	// Check if tables exist first
	if err := db.Migrator().DropTable("transactions"); err != nil {
		// Ignore error if table doesn't exist
		log.Printf("Note: Could not drop transactions table (might not exist): %v", err)
	}

	// Auto migrate all models
	err := db.AutoMigrate(
		&models.Transaction{},
		&models.Report{},
		&models.DAOProposal{},
		&models.DAOVote{},
		&models.ConfirmedScam{},
		&models.Recovery{},

	)

	if err != nil {
		log.Printf("Database migration failed: %v", err)
		return err
	}

	// Ensure indexes are created properly
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS "uni_transactions_tx_hash" ON "transactions"("tx_hash")`).Error; err != nil {
		log.Printf("Warning: Failed to create transaction hash index: %v", err)
		// Don't return error since AutoMigrate should have handled this
	}

	log.Println("Database migrations completed successfully")

	// Add seed data if needed (for development)
	if err := seedDevelopmentData(db); err != nil {
		log.Printf("Warning: Failed to seed development data: %v", err)
	}

	return nil
}

// seedDevelopmentData populates some initial data for development environments
func seedDevelopmentData(db *gorm.DB) error {
	// Only seed if we're in development mode and the tables are empty
	var count int64
	db.Model(&models.DAOProposal{}).Count(&count)

	if count > 0 {
		log.Println("Development data already exists, skipping seeding")
		return nil
	}

	log.Println("Seeding development data...")

	// Create a sample proposal
	proposal := models.DAOProposal{
		Title:          "Integration with Uniswap for in-wallet swaps",
		Description:    "This proposal aims to integrate Uniswap API into our wallet for direct token swaps without leaving the app.",
		CreatorAddress: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0",
		Status:         "active",
		VotesFor:       0,
		VotesAgainst:   0,
	}

	if err := db.Create(&proposal).Error; err != nil {
		return err
	}

	// Create a few more sample proposals
	proposals := []models.DAOProposal{
		{
			Title:          "Implement custom gas fee management",
			Description:    "Add advanced gas fee controls to allow users to optimize transaction costs.",
			CreatorAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
			Status:         "active",
			VotesFor:       5,
			VotesAgainst:   2,
		},
		{
			Title:          "Add support for hardware wallets",
			Description:    "Integrate with common hardware wallets like Ledger and Trezor for improved security.",
			CreatorAddress: "0xfdba8cb37e898b9a38b2172e77e8f39657d5e079",
			Status:         "active",
			VotesFor:       8,
			VotesAgainst:   0,
		},
	}

	if err := db.Create(&proposals).Error; err != nil {
		return err
	}
	// Seed some transaction data
	now := time.Now()
	transactions := []models.Transaction{
		{
			FromAddress: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0",
			ToAddress:   "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
			Value:       1.2,
			Currency:    "ETH",
			TxHash:      "0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
			Network:     "ethereum",
			Risk:        0.1,
			Status:      "safe",
			Timestamp:   now,
			Metadata:    "{}",
		},
		{
			FromAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
			ToAddress:   "0x1234567890abcdef1234567890abcdef12345678", // blacklisted address
			Value:       15.0,
			Currency:    "ETH",
			TxHash:      "0xf1e2d3c4b5a6978d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
			Network:     "ethereum",
			Risk:        0.85,
			Status:      "blocked",
			Timestamp:   now,
			Metadata:    "{}",
		},
	}

	if err := db.Create(&transactions).Error; err != nil {
		return err
	}

	// Seed some scam reports
	reports := []models.Report{
		{
			ReportedAddress: "0x1234567890abcdef1234567890abcdef12345678",
			ReporterAddress: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0",
			Category:        "scam",
			Description:     "This address sent me a phishing link and tried to steal my funds.",
			Status:          "verified",
			Severity:        4,
		},
	}

	if err := db.Create(&reports).Error; err != nil {
		return err
	}

	log.Println("Development data seeded successfully")

	return nil
}
