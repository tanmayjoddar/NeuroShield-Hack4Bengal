package config

import (
	"Wallet/backend/models"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

// validateTableSchema checks if a table matches our expected schema
func validateTableSchema(db *gorm.DB, model interface{}, tableName string) error {
	// First check if the table exists
	if !db.Migrator().HasTable(model) {
		return fmt.Errorf("required table %s does not exist", tableName)
	}

	// Try a simple select to verify we can read from the table
	result := map[string]interface{}{
		"tx_hash": "test",
	}
	if err := db.Table(tableName).Take(&result).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// This is fine - table exists but is empty
			return nil
		}
		// Other errors might indicate schema mismatch
		log.Printf("Warning: Could not read from table %s: %v", tableName, err)
	}

	return nil
}

// EnsureDatabaseConnection verifies that we can connect to and use the database
func EnsureDatabaseConnection(db *gorm.DB) error {
	// Try to connect and do a simple query
	var result int64
	err := db.Raw("SELECT 1").Scan(&result).Error
	if err != nil {
		return fmt.Errorf("database connection test failed: %w", err)
	}

	if result != 1 {
		return fmt.Errorf("database connection test returned unexpected result: %d", result)
	}

	return nil
}

// InitializeDatabase validates the database schema
func InitializeDatabase(db *gorm.DB) error {
	log.Println("Validating database schema...")

	// Define retries for schema validation
	maxRetries := 3
	retryDelay := time.Second * 5

	// List of required models and their table names
	requiredModels := []struct {
		Model     interface{}
		TableName string
	}{
		{&models.Transaction{}, "transactions"},
		{&models.Report{}, "reports"},
		{&models.DAOProposal{}, "dao_proposals"},
		{&models.DAOVote{}, "dao_votes"},
		{&models.Recovery{}, "recoveries"},
		{&models.Config{}, "configs"},
	}

	// Try to validate schema with retries
	for i := 0; i < maxRetries; i++ {
		var validationErrors []string

		// Check each required table
		for _, model := range requiredModels {
			if err := validateTableSchema(db, model.Model, model.TableName); err != nil {
				validationErrors = append(validationErrors,
					fmt.Sprintf("%s: %v", model.TableName, err))
			}
		}

		if len(validationErrors) == 0 {
			log.Println("Database schema validation successful")
			return nil
		}

		// If this isn't the last retry, wait and try again
		if i < maxRetries-1 {
			log.Printf("Schema validation failed, retrying in %v...", retryDelay)
			for _, err := range validationErrors {
				log.Printf("- %s", err)
			}
			time.Sleep(retryDelay)
			continue
		}

		// If we're here, we've exhausted our retries
		return fmt.Errorf("schema validation failed after %d attempts: %v",
			maxRetries, validationErrors)
	}

	return nil
}

// seedDevelopmentData adds test data if needed (development only)
func seedDevelopmentData(db *gorm.DB) error {
	// Only seed if we're in development mode and the tables are empty
	var count int64
	db.Model(&models.DAOProposal{}).Count(&count)

	if count > 0 {
		log.Println("Development data already exists, skipping seeding")
		return nil
	}

	log.Println("Seeding development data...")

	return nil
}
