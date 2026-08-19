package mercadopago

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

func TestCreatePreferenceSendsExactDecimalAndReferences(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/checkout/preferences" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer token" || r.Header.Get("X-Idempotency-Key") != "order-1" {
			t.Fatalf("missing provider headers: %#v", r.Header)
		}
		raw, _ := io.ReadAll(r.Body)
		var payload map[string]any
		decoder := json.NewDecoder(strings.NewReader(string(raw)))
		decoder.UseNumber()
		if err := decoder.Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		item := payload["items"].([]any)[0].(map[string]any)
		if item["unit_price"].(json.Number).String() != "18900.00" || payload["external_reference"] != "order-1" {
			t.Fatalf("unexpected payment payload: %s", raw)
		}
		if !strings.Contains(payload["notification_url"].(string), "source_news=webhooks") {
			t.Fatalf("webhook URL does not explicitly select webhooks: %s", raw)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"pref-1","init_point":"https://mercadopago.example/checkout"}`)
	}))
	defer server.Close()
	client := NewClient("token", "https://store.example")
	client.apiURL = server.URL
	client.httpClient = server.Client()

	preference, err := client.CreatePreference(context.Background(), order.PreferenceRequest{
		OrderID: "order-1", BookID: "book-1", BookSlug: "un-libro", Title: "Un libro",
		AmountMinorUnits: 1_890_000, Currency: "ARS", PayerEmail: "buyer@example.com",
	})
	if err != nil || preference.ID != "pref-1" {
		t.Fatalf("create preference: %#v %v", preference, err)
	}
}

func TestGetPaymentConvertsDecimalWithoutFloat(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":123456,"status":"approved","external_reference":"order-1","transaction_amount":18900.00,"currency_id":"ARS"}`)
	}))
	defer server.Close()
	client := NewClient("token", "https://store.example")
	client.apiURL = server.URL
	client.httpClient = server.Client()
	payment, err := client.GetPayment(context.Background(), "123456")
	if err != nil {
		t.Fatalf("get payment: %v", err)
	}
	if payment.AmountMinorUnits != 1_890_000 || payment.Status != order.PaymentApproved || payment.ExternalReference != "order-1" {
		t.Fatalf("unexpected payment: %#v", payment)
	}
}

func TestMinorUnitsRejectsExcessPrecision(t *testing.T) {
	t.Parallel()
	if _, err := minorUnitsFromDecimal("1.001"); err == nil {
		t.Fatal("expected amount with mill units to be rejected")
	}
}
