package services

import (
	"Wallet/backend/models"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"gorm.io/gorm"
)

type CivicAuthService struct {
	DB     *gorm.DB
	Client *http.Client
	Config *CivicConfig
}

type CivicConfig struct {
	GatekeeperNetwork string
	ChainId           int64
	ApiKey            string
	Stage             string // "prod" or "preprod"
	GatewayToken      string
	CollectionFlow    string
}

func NewCivicAuthService(db *gorm.DB, config *CivicConfig) *CivicAuthService {
	client := &http.Client{
		Timeout: time.Second * 10,
	}
	return &CivicAuthService{
		DB:     db,
		Client: client,
		Config: config,
	}
}

// getBaseURL returns the appropriate Civic API URL based on stage
func (s *CivicAuthService) getBaseURL() string {
	if s.Config.Stage == "prod" {
		return "https://gatekeeper.civic.com/v1"
	}
	return "https://gatekeeper.staging.civic.com/v1"
}

// getAuthBaseURL returns the appropriate Civic Auth URL based on stage
func (s *CivicAuthService) getAuthBaseURL() string {
	if s.Config.Stage == "prod" {
		return "https://auth.civic.com"
	}
	return "https://auth.staging.civic.com"
}

// InitiateAuth starts the Civic authentication process
func (s *CivicAuthService) InitiateAuth(userAddress string, deviceInfo string) (*models.CivicAuthSession, error) {
	// Check for existing valid session
	var existingSession models.CivicAuthSession
	if err := s.DB.Where("user_address = ? AND token_expiry > ?", userAddress, time.Now()).First(&existingSession).Error; err == nil {
		return &existingSession, nil
	}
	// Create new gatepass token using Civic's REST API
	baseURL := s.getBaseURL()

	reqBody := map[string]interface{}{
		"gatekeeperNetwork": s.Config.GatekeeperNetwork,
		"chainId":           s.Config.ChainId,
		"walletAddress":     userAddress,
	}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequestWithContext(context.Background(),
		"POST",
		baseURL+"/gateway/token",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", s.Config.ApiKey)

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create Civic token: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("civic API error: %d", resp.StatusCode)
	}

	var tokenResp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	token := tokenResp.Token

	// Create new session with enhanced security
	session := &models.CivicAuthSession{
		UserAddress:       userAddress,
		GatekeeperNetwork: s.Config.GatekeeperNetwork,
		TokenExpiry:       time.Now().Add(24 * time.Hour),
		Status:           "pending",
		GatePass:         token,
		SecurityLevel:    1,
		DeviceHash:      generateDeviceHash(deviceInfo),
		RiskScore:       0.0,
	}

	if err := s.DB.Create(session).Error; err != nil {
		return nil, fmt.Errorf("failed to create auth session: %v", err)
	}

	// Log the verification attempt
	s.logVerificationAttempt(userAddress, "initial", true, deviceInfo)

	return session, nil
}

// VerifyGatepass validates the Civic gatepass and implements additional security measures
func (s *CivicAuthService) VerifyGatepass(userAddress, gatepass string, deviceInfo string) (*models.CivicAuthSession, error) {
	var session models.CivicAuthSession
	if err := s.DB.Where("user_address = ? AND gate_pass = ?", userAddress, gatepass).First(&session).Error; err != nil {
		return nil, errors.New("invalid session")
	}
	// Verify with Civic gateway using REST API
	baseURL := s.getBaseURL()

	req, err := http.NewRequestWithContext(context.Background(),
		"GET",
		fmt.Sprintf("%s/gateway/token/%s", baseURL, gatepass),
		nil)
	if err != nil {
		s.logVerificationAttempt(userAddress, "verification", false, deviceInfo)
		return nil, fmt.Errorf("failed to create verification request: %v", err)
	}

	req.Header.Set("X-API-Key", s.Config.ApiKey)

	resp, err := s.Client.Do(req)
	if err != nil {
		s.logVerificationAttempt(userAddress, "verification", false, deviceInfo)
		return nil, fmt.Errorf("failed to verify token: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.logVerificationAttempt(userAddress, "verification", false, deviceInfo)
		return nil, fmt.Errorf("civic verification failed: %d", resp.StatusCode)
	}

	var verifyResp struct {
		IsValid bool `json:"isValid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		s.logVerificationAttempt(userAddress, "verification", false, deviceInfo)
		return nil, fmt.Errorf("failed to decode verification response: %v", err)
	}

	if !verifyResp.IsValid {
		s.logVerificationAttempt(userAddress, "verification", false, deviceInfo)
		return nil, errors.New("civic verification failed: token invalid")
	}

	// Enhanced Security Checks
	riskFactors := s.performSecurityChecks(userAddress, deviceInfo)
	if len(riskFactors) > 0 {
		session.Flags = riskFactors
		session.RiskScore = calculateRiskScore(riskFactors)

		// If risk is too high, require additional verification
		if session.RiskScore > 0.7 {
			session.SecurityLevel = 3
			session.Status = "needs_additional_verification"
			s.DB.Save(&session)
			return nil, errors.New("additional verification required due to high risk score")
		}
	}

	// Update session status
	session.Status = "verified"
	session.LastVerified = time.Now()
	if err := s.DB.Save(&session).Error; err != nil {
		return nil, err
	}

	s.logVerificationAttempt(userAddress, "verification", true, deviceInfo)
	return &session, nil
}

// GetUserSession retrieves the latest authentication session for a user
func (s *CivicAuthService) GetUserSession(userAddress string) (*models.CivicAuthSession, error) {
	var session models.CivicAuthSession
	if err := s.DB.Where("user_address = ?", userAddress).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// PerformSecurityChecks implements advanced security measures
func (s *CivicAuthService) performSecurityChecks(userAddress, deviceInfo string) []string {
	var flags []string

	// Check for multiple devices
	var deviceCount int64
	s.DB.Model(&models.CivicAuthSession{}).
		Where("user_address = ? AND device_hash != ?", userAddress, generateDeviceHash(deviceInfo)).
		Count(&deviceCount)

	if deviceCount > 2 {
		flags = append(flags, "multiple_devices_detected")
	}

	// Check for rapid verification attempts
	var recentAttempts int64
	s.DB.Model(&models.CivicVerificationLog{}).
		Where("user_address = ? AND created_at > ?", userAddress, time.Now().Add(-5*time.Minute)).
		Count(&recentAttempts)

	if recentAttempts > 5 {
		flags = append(flags, "rapid_verification_attempts")
	}

	// Geographic anomaly detection
	if geoLocation := extractGeoLocation(deviceInfo); geoLocation != "" {
		var lastLocation string
		s.DB.Model(&models.CivicVerificationLog{}).
			Where("user_address = ? AND geo_location != ''", userAddress).
			Order("created_at desc").
			Limit(1).
			Pluck("geo_location", &lastLocation)

		if lastLocation != "" && lastLocation != geoLocation {
			flags = append(flags, "location_change_detected")
		}
	}

	return flags
}

// LogVerificationAttempt records authentication attempts for security analysis
func (s *CivicAuthService) logVerificationAttempt(userAddress, verificationType string, success bool, deviceInfo string) {
	log := &models.CivicVerificationLog{
		UserAddress:      userAddress,
		VerificationType: verificationType,
		Success:         success,
		DeviceInfo:      deviceInfo,
		GeoLocation:     extractGeoLocation(deviceInfo),
		IPAddress:       extractIPAddress(deviceInfo),
	}
	s.DB.Create(log)
}

// Helper functions
func generateDeviceHash(deviceInfo string) string {
	h := sha256.Sum256([]byte(deviceInfo))
	return hex.EncodeToString(h[:])
}

func calculateRiskScore(flags []string) float64 {
	score := 0.0
	for _, flag := range flags {
		switch flag {
		case "multiple_devices_detected":
			score += 0.3
		case "rapid_verification_attempts":
			score += 0.4
		case "location_change_detected":
			score += 0.2
		}
	}
	if score > 1.0 {
		score = 1.0
	}
	return score
}

func extractGeoLocation(deviceInfo string) string {
	// Parse locale/language part of the device info string for rough geo hint
	// Device info format: "userAgent|language|screenSize" from frontend
	parts := strings.Split(deviceInfo, "|")
	if len(parts) >= 2 {
		lang := parts[1]
		// Extract country code from locale like "en-US" → "US"
		if idx := strings.Index(lang, "-"); idx >= 0 {
			return strings.ToUpper(lang[idx+1:])
		}
		return strings.ToUpper(lang)
	}
	return "UNKNOWN"
}

func extractIPAddress(deviceInfo string) string {
	// IP should be extracted from HTTP request headers, not device info
	// This is a fallback; the handler should pass c.ClientIP() instead
	return "0.0.0.0"
}
