package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterReturns429AndRetryAfter(t *testing.T) {
	limiter := NewRateLimiter(RateLimitConfig{Window: time.Minute, AuthRequests: 2})
	now := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }
	handler := limiter.Auth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for attempt := 1; attempt <= 3; attempt++ {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google", nil)
		request.RemoteAddr = "192.0.2.10:1234"
		handler.ServeHTTP(recorder, request)
		if attempt < 3 && recorder.Code != http.StatusNoContent {
			t.Fatalf("attempt %d should pass: %d", attempt, recorder.Code)
		}
		if attempt == 3 && (recorder.Code != http.StatusTooManyRequests || recorder.Header().Get("Retry-After") != "60") {
			t.Fatalf("expected limited third request: %d %#v", recorder.Code, recorder.Header())
		}
	}
}

func TestRateLimiterResetsWindowAndCleansExpiredKeys(t *testing.T) {
	limiter := NewRateLimiter(RateLimitConfig{Window: time.Minute, AuthRequests: 1})
	now := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }
	handler := limiter.Auth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = "192.0.2.10:1234"
	handler.ServeHTTP(httptest.NewRecorder(), request)
	now = now.Add(time.Minute)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent || len(limiter.entries) != 1 {
		t.Fatalf("expected reset window and expired cleanup, status=%d entries=%d", recorder.Code, len(limiter.entries))
	}
}

func TestRateLimiterTrustsOnlyExplicitProxyHeader(t *testing.T) {
	direct := clientIdentity(false)
	trusted := clientIdentity(true)
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = "192.0.2.10:1234"
	request.Header.Set("X-Real-IP", "198.51.100.5")
	if direct(request) != "192.0.2.10" || trusted(request) != "198.51.100.5" {
		t.Fatalf("unexpected identities: direct=%s trusted=%s", direct(request), trusted(request))
	}
	request.Header.Set("X-Real-IP", "spoofed")
	if trusted(request) != "192.0.2.10" {
		t.Fatal("invalid proxy IP must fall back to the socket address")
	}
}

func TestAdminLimiterUsesAuthenticatedUserAndSkipsReads(t *testing.T) {
	limiter := NewRateLimiter(RateLimitConfig{Window: time.Minute, AdminWriteRequests: 1})
	handler := limiter.AdminWrites(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for _, method := range []string{http.MethodGet, http.MethodGet, http.MethodPut, http.MethodPut} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, "/api/v1/admin/settings", nil)
		request = request.WithContext(context.WithValue(request.Context(), userIDKey, "admin-1"))
		handler.ServeHTTP(recorder, request)
		if method == http.MethodPut && recorder.Code == http.StatusTooManyRequests {
			return
		}
	}
	t.Fatal("expected the second write to be rate limited")
}
