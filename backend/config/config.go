package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Config holds all configuration settings
type Config struct {
	ServerPort    string
	DatabaseURL   string
	MLModelURL    string
	JWTSecret     string
	Environment   string
	BaseURL string
}

// LoadConfig loads configuration from .env file and environment variables
func LoadConfig() (*Config, error) {
	// Load .env file if it exists and we're not in production
	if os.Getenv("ENVIRONMENT") != "production" {
		_ = godotenv.Load()
	}

	// Special handling for Render which uses PORT instead of SERVER_PORT
	serverPort := os.Getenv("PORT")
	if serverPort == "" {
		serverPort = getEnv("SERVER_PORT", "8080")
	}
	cfg := &Config{
		ServerPort:    serverPort,
		DatabaseURL:   getEnv("DATABASE_URL", "postgresql://neondb_owner:npg_ecZ8XOvH9dbp@ep-dark-snow-a1hb7o1k-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"),
		MLModelURL:    getEnv("ML_MODEL_URL", "https://ml-fraud-transaction-detection.onrender.com/predict"),
		JWTSecret:     getEnv("JWT_SECRET", ""),
		Environment:   getEnv("ENVIRONMENT", "production"),
		BaseURL: getEnv("BASE_URL", "https://api.unhackablewallet.com"),
	}

	// Validate configuration
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.MLModelURL == "" {
		return nil, fmt.Errorf("ML_MODEL_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

// InitDB initializes the database connection
func InitDB(cfg *Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		PrepareStmt: true, // Enable prepared statement cache
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set reasonable pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	// Verify connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// getEnv gets an environment variable or returns the default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
