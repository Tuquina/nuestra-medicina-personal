package config

import (
	"strings"
	"testing"
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

func setRequiredTestEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	t.Setenv("GOOGLE_REDIRECT_URL", "")
	t.Setenv("MERCADOPAGO_ACCESS_TOKEN", "")
	t.Setenv("MERCADOPAGO_WEBHOOK_SECRET", "")
	t.Setenv("MERCADOPAGO_PUBLIC_BASE_URL", "")
}
