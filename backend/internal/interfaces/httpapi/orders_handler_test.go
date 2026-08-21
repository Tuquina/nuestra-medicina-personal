package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type observableOrderServiceStub struct {
	created   order.Order
	processed order.Order
}

func (s observableOrderServiceStub) Create(context.Context, string, string, string, string) (order.Order, error) {
	return s.created, nil
}

func (observableOrderServiceStub) Get(context.Context, string, string) (order.Order, error) {
	return order.Order{}, nil
}

func (s observableOrderServiceStub) ProcessPayment(context.Context, string) (order.Order, error) {
	return s.processed, nil
}

type webhookValidatorStub struct{}

func (webhookValidatorStub) Validate(string, string, string) error { return nil }

func TestOrderCreationLogCorrelatesRequestUserAndOrder(t *testing.T) {
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))
	handler := NewOrderHandler(observableOrderServiceStub{created: order.Order{ID: "order-1"}}, webhookValidatorStub{}, logger)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader(`{"bookSlug":"book-one"}`))
	ctx := context.WithValue(request.Context(), requestIDKey, "request-1")
	ctx = context.WithValue(ctx, userIDKey, "user-1")
	ctx = context.WithValue(ctx, currentUserKey, auth.User{ID: "user-1", Email: "buyer@example.com"})
	recorder := httptest.NewRecorder()
	handler.Create(recorder, request.WithContext(ctx))

	entry := decodeLogEntry(t, output.Bytes())
	if entry["request_id"] != "request-1" || entry["user_id"] != "user-1" || entry["order_id"] != "order-1" {
		t.Fatalf("order log correlation is incomplete: %#v", entry)
	}
	if entry["book_slug"] != "book-one" {
		t.Fatalf("book context is missing: %#v", entry)
	}
}

func TestWebhookLogCorrelatesProviderPaymentAndOrder(t *testing.T) {
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))
	handler := NewOrderHandler(observableOrderServiceStub{processed: order.Order{ID: "order-1", Status: order.StatusPaid}}, webhookValidatorStub{}, logger)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/mercadopago?data.id=payment-1", nil)
	request = request.WithContext(context.WithValue(request.Context(), requestIDKey, "request-1"))
	recorder := httptest.NewRecorder()
	handler.MercadoPagoWebhook(recorder, request)

	entry := decodeLogEntry(t, output.Bytes())
	if entry["payment_id"] != "payment-1" || entry["order_id"] != "order-1" || entry["order_status"] != "PAID" {
		t.Fatalf("payment log correlation is incomplete: %#v", entry)
	}
}

func decodeLogEntry(t *testing.T, value []byte) map[string]any {
	t.Helper()
	var entry map[string]any
	if err := json.Unmarshal(value, &entry); err != nil {
		t.Fatalf("decode log entry: %v: %s", err, value)
	}
	return entry
}
