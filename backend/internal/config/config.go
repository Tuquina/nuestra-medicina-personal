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
	Environment              string
	BaseURL                  string
	HTTPAddress              string
	DatabaseURL              string
	AdminGoogleSub           string
	GoogleClientID           string
	GoogleSecret             string
	GoogleRedirect           string
	MercadoPagoToken         string
	MercadoPagoWebhookSecret string
	MercadoPagoPublicBaseURL string
	EbookStoragePath         string
	EbookInternalPrefix      string
	EbookMaxUploadBytes      int64
	SessionCookie            string
	SessionTTL               time.Duration
	ShutdownTimeout          time.Duration
	ReadTimeout              time.Duration
	WriteTimeout             time.Duration
	IdleTimeout              time.Duration
	DatabaseTimeout          time.Duration
	MaxDBConns               int32
}

func Load() (Config, error) {
	cfg := Config{
		Environment:              envOrDefault("APP_ENV", "development"),
		BaseURL:                  envOrDefault("APP_BASE_URL", "http://localhost:5173"),
		HTTPAddress:              envOrDefault("HTTP_ADDRESS", ":8080"),
		DatabaseURL:              os.Getenv("DATABASE_URL"),
		AdminGoogleSub:           os.Getenv("ADMIN_GOOGLE_SUB"),
		GoogleClientID:           os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:             os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirect:           os.Getenv("GOOGLE_REDIRECT_URL"),
		MercadoPagoToken:         os.Getenv("MERCADOPAGO_ACCESS_TOKEN"),
		MercadoPagoWebhookSecret: os.Getenv("MERCADOPAGO_WEBHOOK_SECRET"),
		MercadoPagoPublicBaseURL: os.Getenv("MERCADOPAGO_PUBLIC_BASE_URL"),
		EbookStoragePath:         envOrDefault("EBOOK_STORAGE_PATH", "/data/ebooks"),
		EbookInternalPrefix:      envOrDefault("EBOOK_INTERNAL_PREFIX", "/_protected/ebooks"),
		EbookMaxUploadBytes:      int64OrDefault("EBOOK_MAX_UPLOAD_BYTES", 50<<20),
		SessionCookie:            envOrDefault("SESSION_COOKIE_NAME", "nmp_session"),
		SessionTTL:               durationOrDefault("SESSION_TTL", 30*24*time.Hour),
		ShutdownTimeout:          durationOrDefault("SHUTDOWN_TIMEOUT", 10*time.Second),
		ReadTimeout:              durationOrDefault("HTTP_READ_TIMEOUT", 10*time.Second),
		WriteTimeout:             durationOrDefault("HTTP_WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:              durationOrDefault("HTTP_IDLE_TIMEOUT", 60*time.Second),
		DatabaseTimeout:          durationOrDefault("DATABASE_TIMEOUT", 5*time.Second),
		MaxDBConns:               int32OrDefault("DATABASE_MAX_CONNECTIONS", 5),
	}

	var validationErrors []error
	if cfg.DatabaseURL == "" {
		validationErrors = append(validationErrors, errors.New("DATABASE_URL is required"))
	}
	if cfg.MaxDBConns < 1 || cfg.MaxDBConns > 20 {
		validationErrors = append(validationErrors, errors.New("DATABASE_MAX_CONNECTIONS must be between 1 and 20"))
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

func (c Config) String() string {
	return fmt.Sprintf("environment=%s address=%s max_db_connections=%d", c.Environment, c.HTTPAddress, c.MaxDBConns)
}
