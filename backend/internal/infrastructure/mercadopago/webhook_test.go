package mercadopago

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

func TestWebhookSignatureValidation(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 8, 19, 15, 30, 0, 0, time.UTC)
	validator := NewWebhookValidator("webhook-secret")
	validator.now = func() time.Time { return now }
	timestamp := "1787153400000"
	template := "id:payment-123;request-id:request-1;ts:" + timestamp + ";"
	mac := hmac.New(sha256.New, []byte("webhook-secret"))
	_, _ = mac.Write([]byte(template))
	signature := "ts=" + timestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	if err := validator.Validate(signature, "request-1", "PAYMENT-123"); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if err := validator.Validate(signature, "different-request", "PAYMENT-123"); !errors.Is(err, order.ErrInvalidWebhook) {
		t.Fatalf("expected invalid signature, got %v", err)
	}
}

func TestWebhookRejectsStaleTimestamp(t *testing.T) {
	t.Parallel()
	validator := NewWebhookValidator("secret")
	validator.now = func() time.Time { return time.Unix(2000, 0) }
	if err := validator.Validate("ts=1000,v1=00", "request", "payment"); !errors.Is(err, order.ErrInvalidWebhook) {
		t.Fatalf("expected stale webhook rejection, got %v", err)
	}
}
