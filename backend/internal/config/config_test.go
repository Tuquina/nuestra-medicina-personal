package config

import (
	"strings"
	"testing"
	"time"
)

func TestMercadoPagoConfigurationIsAllOrNothing(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("MERCADOPAGO_ACCESS_TOKEN", "token")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "must be configured together") {
		t.Fatalf("expected partial Mercado Pago configuration error, got %v", err)
	}
}

func TestMercadoPagoPublicURLMustUseHTTPS(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("MERCADOPAGO_ACCESS_TOKEN", "token")
	t.Setenv("MERCADOPAGO_WEBHOOK_SECRET", "secret")
	t.Setenv("MERCADOPAGO_PUBLIC_BASE_URL", "http://localhost:5173")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "absolute HTTPS URL") {
		t.Fatalf("expected public HTTPS validation error, got %v", err)
	}
}

func TestCompleteMercadoPagoConfigurationLoads(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("MERCADOPAGO_ACCESS_TOKEN", "token")
	t.Setenv("MERCADOPAGO_WEBHOOK_SECRET", "secret")
	t.Setenv("MERCADOPAGO_PUBLIC_BASE_URL", "https://store.example")
	if _, err := Load(); err != nil {
		t.Fatalf("load complete configuration: %v", err)
	}
}

func TestEbookUploadConfigurationValidation(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("EBOOK_INTERNAL_PREFIX", "../public")
	t.Setenv("EBOOK_MAX_UPLOAD_BYTES", "100")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "EBOOK_INTERNAL_PREFIX") || !strings.Contains(err.Error(), "EBOOK_MAX_UPLOAD_BYTES") {
		t.Fatalf("expected ebook configuration errors, got %v", err)
	}
}

func TestMediaUploadConfigurationValidation(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("MEDIA_MAX_UPLOAD_BYTES", "100")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "MEDIA_MAX_UPLOAD_BYTES") {
		t.Fatalf("expected media configuration errors, got %v", err)
	}
}

func TestGoogleMailConfigurationIsAllOrNothing(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("GOOGLE_MAIL_SENDER", "ventas@example.com")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "GOOGLE_MAIL_CREDENTIALS_PATH") {
		t.Fatalf("expected partial Google mail configuration error, got %v", err)
	}
}

func TestEmailWorkerConfigurationValidation(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("EMAIL_BATCH_SIZE", "100")
	t.Setenv("EMAIL_MAX_ATTEMPTS", "0")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "EMAIL_BATCH_SIZE") || !strings.Contains(err.Error(), "EMAIL_MAX_ATTEMPTS") {
		t.Fatalf("expected email worker configuration errors, got %v", err)
	}
}

func TestRateLimitAndHTTPBoundaryConfiguration(t *testing.T) {
	setRequiredTestEnvironment(t)
	t.Setenv("RATE_LIMIT_WINDOW", "not-a-duration")
	t.Setenv("RATE_LIMIT_AUTH_REQUESTS", "0")
	t.Setenv("TRUST_PROXY_HEADERS", "sometimes")
	t.Setenv("HTTP_MAX_HEADER_BYTES", "100")
	t.Setenv("HTTP_MAX_REQUEST_URI_BYTES", "999999")
	_, err := Load()
	for _, expected := range []string{
		"RATE_LIMIT_WINDOW", "RATE_LIMIT_AUTH_REQUESTS", "TRUST_PROXY_HEADERS",
		"HTTP_MAX_HEADER_BYTES", "HTTP_MAX_REQUEST_URI_BYTES",
	} {
		if err == nil || !strings.Contains(err.Error(), expected) {
			t.Fatalf("expected %s validation error, got %v", expected, err)
		}
	}
}

func TestRateLimitDefaultsLoad(t *testing.T) {
	setRequiredTestEnvironment(t)
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.RateLimitWindow != time.Minute || cfg.RateLimitAuthRequests != 10 || cfg.MaxHeaderBytes != 32<<10 || cfg.TrustProxyHeaders {
		t.Fatalf("unexpected boundary defaults: %#v", cfg)
	}
}

func setRequiredTestEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	t.Setenv("GOOGLE_REDIRECT_URL", "")
	t.Setenv("MERCADOPAGO_ACCESS_TOKEN", "")
	t.Setenv("MERCADOPAGO_WEBHOOK_SECRET", "")
	t.Setenv("MERCADOPAGO_PUBLIC_BASE_URL", "")
	t.Setenv("GOOGLE_MAIL_CREDENTIALS_PATH", "")
	t.Setenv("GOOGLE_MAIL_SENDER", "")
	t.Setenv("SUPPORT_EMAIL", "")
	t.Setenv("RATE_LIMIT_WINDOW", "")
	t.Setenv("RATE_LIMIT_AUTH_REQUESTS", "")
	t.Setenv("RATE_LIMIT_ORDER_REQUESTS", "")
	t.Setenv("RATE_LIMIT_DOWNLOAD_REQUESTS", "")
	t.Setenv("RATE_LIMIT_ADMIN_WRITE_REQUESTS", "")
	t.Setenv("TRUST_PROXY_HEADERS", "")
	t.Setenv("HTTP_MAX_HEADER_BYTES", "")
	t.Setenv("HTTP_MAX_REQUEST_URI_BYTES", "")
}
