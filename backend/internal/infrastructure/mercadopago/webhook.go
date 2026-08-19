package mercadopago

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type WebhookValidator struct {
	secret    string
	now       func() time.Time
	tolerance time.Duration
}

func NewWebhookValidator(secret string) *WebhookValidator {
	return &WebhookValidator{secret: secret, now: time.Now, tolerance: 5 * time.Minute}
}

func (v *WebhookValidator) Validate(signature, requestID, dataID string) error {
	if v.secret == "" || signature == "" || requestID == "" || dataID == "" {
		return order.ErrInvalidWebhook
	}
	parts := make(map[string]string)
	for _, part := range strings.Split(signature, ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok {
			parts[key] = value
		}
	}
	timestamp, err := strconv.ParseInt(parts["ts"], 10, 64)
	if err != nil || parts["v1"] == "" {
		return order.ErrInvalidWebhook
	}
	when := time.Unix(timestamp, 0)
	if timestamp > 1_000_000_000_000 {
		when = time.UnixMilli(timestamp)
	}
	difference := v.now().Sub(when)
	if difference < -v.tolerance || difference > v.tolerance {
		return order.ErrInvalidWebhook
	}
	template := "id:" + strings.ToLower(dataID) + ";request-id:" + requestID + ";ts:" + parts["ts"] + ";"
	mac := hmac.New(sha256.New, []byte(v.secret))
	_, _ = mac.Write([]byte(template))
	expected := mac.Sum(nil)
	received, err := hex.DecodeString(parts["v1"])
	if err != nil || !hmac.Equal(received, expected) {
		return order.ErrInvalidWebhook
	}
	return nil
}
