package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment               string
	BaseURL                   string
	HTTPAddress               string
	DatabaseURL               string
	AdminGoogleSub            string
	GoogleClientID            string
	GoogleSecret              string
	GoogleRedirect            string
	MercadoPagoToken          string
	MercadoPagoWebhookSecret  string
	MercadoPagoPublicBaseURL  string
	// MercadoPagoAPIBaseURL overrides which host the client talks to for
	// preference creation/payment verification. Empty in production (the
	// client defaults to the real Mercado Pago API) — only E2E tests set
	// this, to point at a fake server instead.
	MercadoPagoAPIBaseURL string
	EbookStoragePath          string
	EbookInternalPrefix       string
	EbookMaxUploadBytes       int64
	MediaStoragePath          string
	MediaMaxUploadBytes       int64
	ManuscriptMaxUploadBytes  int64
	GoogleMailCredentials     string
	GoogleMailSender          string
	SupportEmail              string
	EmailWorkerInterval       time.Duration
	EmailLeaseTimeout         time.Duration
	EmailBatchSize            int
	EmailMaxAttempts          int
	SessionCookie             string
	SessionTTL                time.Duration
	ShutdownTimeout           time.Duration
	ReadTimeout               time.Duration
	WriteTimeout              time.Duration
	IdleTimeout               time.Duration
	DatabaseTimeout           time.Duration
	MaxDBConns                int32
	RateLimitWindow           time.Duration
	RateLimitAuthRequests     int
	RateLimitOrderRequests    int
	RateLimitDownloadRequests int
	RateLimitAdminWrites      int
	TrustProxyHeaders         bool
	MaxHeaderBytes            int
	MaxRequestURIBytes        int
}

func Load() (Config, error) {
	rateLimitWindow, rateLimitWindowErr := strictDurationOrDefault("RATE_LIMIT_WINDOW", time.Minute)
	rateLimitAuth, rateLimitAuthErr := strictIntOrDefault("RATE_LIMIT_AUTH_REQUESTS", 10)
	rateLimitOrders, rateLimitOrdersErr := strictIntOrDefault("RATE_LIMIT_ORDER_REQUESTS", 5)
	rateLimitDownloads, rateLimitDownloadsErr := strictIntOrDefault("RATE_LIMIT_DOWNLOAD_REQUESTS", 30)
	rateLimitAdmin, rateLimitAdminErr := strictIntOrDefault("RATE_LIMIT_ADMIN_WRITE_REQUESTS", 60)
	trustProxyHeaders, trustProxyErr := strictBoolOrDefault("TRUST_PROXY_HEADERS", false)
	maxHeaderBytes, maxHeaderBytesErr := strictIntOrDefault("HTTP_MAX_HEADER_BYTES", 32<<10)
	maxRequestURIBytes, maxRequestURIErr := strictIntOrDefault("HTTP_MAX_REQUEST_URI_BYTES", 8<<10)
	cfg := Config{
		Environment:               envOrDefault("APP_ENV", "development"),
		BaseURL:                   envOrDefault("APP_BASE_URL", "http://localhost:5173"),
		HTTPAddress:               envOrDefault("HTTP_ADDRESS", ":8080"),
		DatabaseURL:               os.Getenv("DATABASE_URL"),
		AdminGoogleSub:            os.Getenv("ADMIN_GOOGLE_SUB"),
		GoogleClientID:            os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:              os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirect:            os.Getenv("GOOGLE_REDIRECT_URL"),
		MercadoPagoToken:          os.Getenv("MERCADOPAGO_ACCESS_TOKEN"),
		MercadoPagoWebhookSecret:  os.Getenv("MERCADOPAGO_WEBHOOK_SECRET"),
		MercadoPagoPublicBaseURL:  os.Getenv("MERCADOPAGO_PUBLIC_BASE_URL"),
		MercadoPagoAPIBaseURL:     os.Getenv("MERCADOPAGO_API_BASE_URL"),
		EbookStoragePath:          envOrDefault("EBOOK_STORAGE_PATH", "/data/ebooks"),
		EbookInternalPrefix:       envOrDefault("EBOOK_INTERNAL_PREFIX", "/_protected/ebooks"),
		EbookMaxUploadBytes:       int64OrDefault("EBOOK_MAX_UPLOAD_BYTES", 50<<20),
		MediaStoragePath:          envOrDefault("MEDIA_STORAGE_PATH", "/data/media"),
		MediaMaxUploadBytes:       int64OrDefault("MEDIA_MAX_UPLOAD_BYTES", 10<<20),
		ManuscriptMaxUploadBytes:  int64OrDefault("MANUSCRIPT_MAX_UPLOAD_BYTES", 20<<20),
		GoogleMailCredentials:     os.Getenv("GOOGLE_MAIL_CREDENTIALS_PATH"),
		GoogleMailSender:          os.Getenv("GOOGLE_MAIL_SENDER"),
		SupportEmail:              os.Getenv("SUPPORT_EMAIL"),
		EmailWorkerInterval:       durationOrDefault("EMAIL_WORKER_INTERVAL", 10*time.Second),
		EmailLeaseTimeout:         durationOrDefault("EMAIL_LEASE_TIMEOUT", 5*time.Minute),
		EmailBatchSize:            intOrDefault("EMAIL_BATCH_SIZE", 5),
		EmailMaxAttempts:          intOrDefault("EMAIL_MAX_ATTEMPTS", 5),
		SessionCookie:             envOrDefault("SESSION_COOKIE_NAME", "nmp_session"),
		SessionTTL:                durationOrDefault("SESSION_TTL", 30*24*time.Hour),
		ShutdownTimeout:           durationOrDefault("SHUTDOWN_TIMEOUT", 10*time.Second),
		ReadTimeout:               durationOrDefault("HTTP_READ_TIMEOUT", 10*time.Second),
		WriteTimeout:              durationOrDefault("HTTP_WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:               durationOrDefault("HTTP_IDLE_TIMEOUT", 60*time.Second),
		DatabaseTimeout:           durationOrDefault("DATABASE_TIMEOUT", 5*time.Second),
		MaxDBConns:                int32OrDefault("DATABASE_MAX_CONNECTIONS", 5),
		RateLimitWindow:           rateLimitWindow,
		RateLimitAuthRequests:     rateLimitAuth,
		RateLimitOrderRequests:    rateLimitOrders,
		RateLimitDownloadRequests: rateLimitDownloads,
		RateLimitAdminWrites:      rateLimitAdmin,
		TrustProxyHeaders:         trustProxyHeaders,
		MaxHeaderBytes:            maxHeaderBytes,
		MaxRequestURIBytes:        maxRequestURIBytes,
	}

	validationErrors := compactErrors([]error{
		rateLimitWindowErr, rateLimitAuthErr, rateLimitOrdersErr, rateLimitDownloadsErr,
		rateLimitAdminErr, trustProxyErr, maxHeaderBytesErr, maxRequestURIErr,
	})
	if cfg.DatabaseURL == "" {
		validationErrors = append(validationErrors, errors.New("DATABASE_URL is required"))
	}
	if cfg.MaxDBConns < 1 || cfg.MaxDBConns > 20 {
		validationErrors = append(validationErrors, errors.New("DATABASE_MAX_CONNECTIONS must be between 1 and 20"))
	}
	if cfg.RateLimitWindow < time.Second || cfg.RateLimitWindow > time.Hour {
		validationErrors = append(validationErrors, errors.New("RATE_LIMIT_WINDOW must be between 1s and 1h"))
	}
	for name, value := range map[string]int{
		"RATE_LIMIT_AUTH_REQUESTS":        cfg.RateLimitAuthRequests,
		"RATE_LIMIT_ORDER_REQUESTS":       cfg.RateLimitOrderRequests,
		"RATE_LIMIT_DOWNLOAD_REQUESTS":    cfg.RateLimitDownloadRequests,
		"RATE_LIMIT_ADMIN_WRITE_REQUESTS": cfg.RateLimitAdminWrites,
	} {
		if value < 1 || value > 10_000 {
			validationErrors = append(validationErrors, fmt.Errorf("%s must be between 1 and 10000", name))
		}
	}
	if cfg.MaxHeaderBytes < 8<<10 || cfg.MaxHeaderBytes > 1<<20 {
		validationErrors = append(validationErrors, errors.New("HTTP_MAX_HEADER_BYTES must be between 8192 and 1048576"))
	}
	if cfg.MaxRequestURIBytes < 1<<10 || cfg.MaxRequestURIBytes > 64<<10 {
		validationErrors = append(validationErrors, errors.New("HTTP_MAX_REQUEST_URI_BYTES must be between 1024 and 65536"))
	}
	if cfg.BaseURL == "" {
		validationErrors = append(validationErrors, errors.New("APP_BASE_URL is required"))
	}
	if cfg.EbookStoragePath == "" {
		validationErrors = append(validationErrors, errors.New("EBOOK_STORAGE_PATH is required"))
	}
	if cfg.EbookInternalPrefix == "" || cfg.EbookInternalPrefix[0] != '/' ||
		strings.Contains(cfg.EbookInternalPrefix, "..") || strings.HasSuffix(cfg.EbookInternalPrefix, "/") {
		validationErrors = append(validationErrors, errors.New("EBOOK_INTERNAL_PREFIX must be an absolute URL path without traversal or a trailing slash"))
	}
	if cfg.EbookMaxUploadBytes < 1<<20 || cfg.EbookMaxUploadBytes > 200<<20 {
		validationErrors = append(validationErrors, errors.New("EBOOK_MAX_UPLOAD_BYTES must be between 1 MiB and 200 MiB"))
	}
	if cfg.MediaStoragePath == "" {
		validationErrors = append(validationErrors, errors.New("MEDIA_STORAGE_PATH is required"))
	}
	if cfg.MediaMaxUploadBytes < 1<<20 || cfg.MediaMaxUploadBytes > 25<<20 {
		validationErrors = append(validationErrors, errors.New("MEDIA_MAX_UPLOAD_BYTES must be between 1 MiB and 25 MiB"))
	}
	if cfg.ManuscriptMaxUploadBytes < 1<<20 || cfg.ManuscriptMaxUploadBytes > 50<<20 {
		validationErrors = append(validationErrors, errors.New("MANUSCRIPT_MAX_UPLOAD_BYTES must be between 1 MiB and 50 MiB"))
	}
	mailValues := 0
	for _, value := range []string{cfg.GoogleMailCredentials, cfg.GoogleMailSender} {
		if value != "" {
			mailValues++
		}
	}
	if mailValues != 0 && mailValues != 2 {
		validationErrors = append(validationErrors, errors.New("GOOGLE_MAIL_CREDENTIALS_PATH and GOOGLE_MAIL_SENDER must be configured together"))
	}
	if cfg.SupportEmail == "" {
		cfg.SupportEmail = cfg.GoogleMailSender
	}
	if cfg.EmailWorkerInterval < time.Second || cfg.EmailWorkerInterval > time.Hour {
		validationErrors = append(validationErrors, errors.New("EMAIL_WORKER_INTERVAL must be between 1s and 1h"))
	}
	if cfg.EmailLeaseTimeout < 30*time.Second || cfg.EmailLeaseTimeout > time.Hour {
		validationErrors = append(validationErrors, errors.New("EMAIL_LEASE_TIMEOUT must be between 30s and 1h"))
	}
	if cfg.EmailBatchSize < 1 || cfg.EmailBatchSize > 50 {
		validationErrors = append(validationErrors, errors.New("EMAIL_BATCH_SIZE must be between 1 and 50"))
	}
	if cfg.EmailMaxAttempts < 1 || cfg.EmailMaxAttempts > 10 {
		validationErrors = append(validationErrors, errors.New("EMAIL_MAX_ATTEMPTS must be between 1 and 10"))
	}
	googleValues := 0
	for _, value := range []string{cfg.GoogleClientID, cfg.GoogleSecret, cfg.GoogleRedirect} {
		if value != "" {
			googleValues++
		}
	}
	if (cfg.GoogleClientID != "" || cfg.GoogleSecret != "") && googleValues != 3 {
		validationErrors = append(validationErrors, errors.New("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URL must be configured together"))
	}
	if cfg.SessionTTL < time.Hour {
		validationErrors = append(validationErrors, errors.New("SESSION_TTL must be at least 1h"))
	}
	mercadoPagoValues := 0
	for _, value := range []string{cfg.MercadoPagoToken, cfg.MercadoPagoWebhookSecret, cfg.MercadoPagoPublicBaseURL} {
		if value != "" {
			mercadoPagoValues++
		}
	}
	if mercadoPagoValues != 0 && mercadoPagoValues != 3 {
		validationErrors = append(validationErrors, errors.New("MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET and MERCADOPAGO_PUBLIC_BASE_URL must be configured together"))
	}
	if mercadoPagoValues == 3 {
		parsed, err := url.Parse(cfg.MercadoPagoPublicBaseURL)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
			validationErrors = append(validationErrors, errors.New("MERCADOPAGO_PUBLIC_BASE_URL must be an absolute HTTPS URL"))
		}
	}
	return cfg, errors.Join(validationErrors...)
}

func (c Config) SecureCookies() bool {
	return c.Environment != "development" && c.Environment != "test"
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationOrDefault(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func int32OrDefault(key string, fallback int32) int32 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 32)
	if err != nil {
		return fallback
	}
	return int32(parsed)
}

func int64OrDefault(key string, fallback int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func intOrDefault(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func strictDurationOrDefault(key string, fallback time.Duration) (time.Duration, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback, fmt.Errorf("%s must be a valid duration", key)
	}
	return parsed, nil
}

func strictIntOrDefault(key string, fallback int) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback, fmt.Errorf("%s must be an integer", key)
	}
	return parsed, nil
}

func strictBoolOrDefault(key string, fallback bool) (bool, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback, fmt.Errorf("%s must be true or false", key)
	}
	return parsed, nil
}

func compactErrors(values []error) []error {
	result := make([]error, 0, len(values))
	for _, value := range values {
		if value != nil {
			result = append(result, value)
		}
	}
	return result
}

func (c Config) String() string {
	return fmt.Sprintf("environment=%s address=%s max_db_connections=%d", c.Environment, c.HTTPAddress, c.MaxDBConns)
}
