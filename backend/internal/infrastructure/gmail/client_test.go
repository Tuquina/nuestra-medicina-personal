package gmail

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

func TestClientSendsBase64URLMIMEMessage(t *testing.T) {
	var rawMessage []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.Header.Get("Content-Type"))
		}
		var body struct {
			Raw string `json:"raw"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		var err error
		rawMessage, err = base64.RawURLEncoding.DecodeString(body.Raw)
		if err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"gmail-message-1"}`)
	}))
	defer server.Close()
	client := &Client{sender: "ventas@example.com", client: server.Client(), baseURL: server.URL}
	providerID, err := client.Send(context.Background(), emaildomain.Message{
		To: "buyer@example.com", Subject: "Compra confirmada",
		TextBody: "Texto", HTMLBody: "<p>Texto</p>",
	})
	if err != nil || providerID != "gmail-message-1" {
		t.Fatalf("send: id=%q err=%v", providerID, err)
	}
	value := string(rawMessage)
	for _, expected := range []string{"From: <ventas@example.com>", "To: <buyer@example.com>", "multipart/alternative", "quoted-printable"} {
		if !strings.Contains(value, expected) {
			t.Fatalf("MIME message does not contain %q: %s", expected, value)
		}
	}
}

func TestBuildMIMERejectsHeaderInjection(t *testing.T) {
	_, err := buildMIME("ventas@example.com", emaildomain.Message{
		To: "buyer@example.com", Subject: "Subject\r\nBcc: attacker@example.com",
	})
	if err == nil {
		t.Fatal("expected subject injection to be rejected")
	}
}

func TestClientReturnsBoundedProviderError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, strings.Repeat("x", 5000), http.StatusTooManyRequests)
	}))
	defer server.Close()
	client := &Client{sender: "ventas@example.com", client: server.Client(), baseURL: server.URL}
	_, err := client.Send(context.Background(), emaildomain.Message{To: "buyer@example.com", Subject: "Test"})
	if err == nil || len(err.Error()) > 4200 {
		t.Fatalf("expected bounded provider error, got %v", err)
	}
}
