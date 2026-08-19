package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Environment     string
	BaseURL         string
	HTTPAddress     string
	DatabaseURL     string
	AdminGoogleSub  string
	SessionCookie   string
	ShutdownTimeout time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	DatabaseTimeout time.Duration
	MaxDBConns      int32
}

func Load() (Config, error) {
	cfg := Config{
		Environment:     envOrDefault("APP_ENV", "development"),
		BaseURL:         envOrDefault("APP_BASE_URL", "http://localhost:5173"),
		HTTPAddress:     envOrDefault("HTTP_ADDRESS", ":8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		AdminGoogleSub:  os.Getenv("ADMIN_GOOGLE_SUB"),
		SessionCookie:   envOrDefault("SESSION_COOKIE_NAME", "nmp_session"),
		ShutdownTimeout: durationOrDefault("SHUTDOWN_TIMEOUT", 10*time.Second),
		ReadTimeout:     durationOrDefault("HTTP_READ_TIMEOUT", 10*time.Second),
		WriteTimeout:    durationOrDefault("HTTP_WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:     durationOrDefault("HTTP_IDLE_TIMEOUT", 60*time.Second),
		DatabaseTimeout: durationOrDefault("DATABASE_TIMEOUT", 5*time.Second),
		MaxDBConns:      int32OrDefault("DATABASE_MAX_CONNECTIONS", 5),
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
	return cfg, errors.Join(validationErrors...)
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

func (c Config) String() string {
	return fmt.Sprintf("environment=%s address=%s max_db_connections=%d", c.Environment, c.HTTPAddress, c.MaxDBConns)
}
