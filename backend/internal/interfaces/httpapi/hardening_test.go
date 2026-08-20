package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	orderdomain "github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type rateLimitOrderServiceStub struct{}

func (rateLimitOrderServiceStub) Create(context.Context, string, string, string) (orderdomain.Order, error) {
	return orderdomain.Order{ID: "order-1", Items: []orderdomain.Item{}}, nil
}
func (rateLimitOrderServiceStub) Get(context.Context, string, string) (orderdomain.Order, error) {
	return orderdomain.Order{}, nil
}
func (rateLimitOrderServiceStub) ProcessPayment(context.Context, string) (orderdomain.Order, error) {
	return orderdomain.Order{}, nil
}

func TestRouterLimitsAuthenticationStartsByClientIP(t *testing.T) {
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		RateLimits: RateLimitConfig{Window: time.Minute, AuthRequests: 1},
	})
	for attempt := 1; attempt <= 2; attempt++ {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google", nil)
		request.RemoteAddr = "192.0.2.10:1234"
		router.ServeHTTP(recorder, request)
		if attempt == 1 && recorder.Code != http.StatusFound {
			t.Fatalf("expected first auth start to pass, got %d", recorder.Code)
		}
		if attempt == 2 && recorder.Code != http.StatusTooManyRequests {
			t.Fatalf("expected second auth start to be limited, got %d: %s", recorder.Code, recorder.Body.String())
		}
	}
}

func TestRouterLimitsDownloadsAfterAuthentication(t *testing.T) {
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Library: libraryServiceStub{}, Database: healthStub{},
		AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		EbookInternalPrefix: "/_protected/ebooks", RateLimits: RateLimitConfig{Window: time.Minute, DownloadRequests: 1},
	})
	for attempt := 1; attempt <= 2; attempt++ {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/v1/books/book-id/download", nil)
		request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
		router.ServeHTTP(recorder, request)
		if attempt == 1 && recorder.Code != http.StatusOK {
			t.Fatalf("expected first download to pass, got %d: %s", recorder.Code, recorder.Body.String())
		}
		if attempt == 2 && recorder.Code != http.StatusTooManyRequests {
			t.Fatalf("expected second download to be limited, got %d: %s", recorder.Code, recorder.Body.String())
		}
	}
}

func TestRouterLimitsOrderCreationByAuthenticatedUser(t *testing.T) {
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Orders: rateLimitOrderServiceStub{}, Database: healthStub{},
		AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		RateLimits: RateLimitConfig{Window: time.Minute, OrderRequests: 1},
	})
	for attempt := 1; attempt <= 2; attempt++ {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/v1/orders", strings.NewReader(`{"bookSlug":"book"}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Origin", "http://localhost:5173")
		request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
		router.ServeHTTP(recorder, request)
		if attempt == 1 && recorder.Code != http.StatusCreated {
			t.Fatalf("expected first order to pass, got %d: %s", recorder.Code, recorder.Body.String())
		}
		if attempt == 2 && recorder.Code != http.StatusTooManyRequests {
			t.Fatalf("expected second order to be limited, got %d: %s", recorder.Code, recorder.Body.String())
		}
	}
}

func TestRouterRejectsOversizedRequestURI(t *testing.T) {
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session", MaxRequestURIBytes: 32,
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/books?query="+strings.Repeat("a", 64), nil))
	if recorder.Code != http.StatusRequestURITooLong || !strings.Contains(recorder.Body.String(), "REQUEST_URI_TOO_LONG") {
		t.Fatalf("expected 414 boundary response, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestRouterSanitizesRequestIDAndAddsProductionHeaders(t *testing.T) {
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "https://store.example", SessionCookie: "nmp_session", SecureCookies: true,
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	request.Header.Set("X-Request-ID", "unsafe request id")
	router.ServeHTTP(recorder, request)
	requestID := recorder.Header().Get("X-Request-ID")
	if requestID == "unsafe request id" || !validRequestID(requestID) {
		t.Fatalf("request ID was not replaced safely: %q", requestID)
	}
	if recorder.Header().Get("Strict-Transport-Security") == "" || recorder.Header().Get("Content-Security-Policy") == "" {
		t.Fatalf("missing production security headers: %#v", recorder.Header())
	}
}
