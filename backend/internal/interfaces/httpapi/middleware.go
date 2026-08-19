package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"runtime/debug"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	userIDKey    contextKey = "user_id"
)

type AdminAuthorizer interface {
	AuthorizeAdmin(context.Context, string) (string, error)
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" || len(requestID) > 128 {
			var value [16]byte
			if _, err := rand.Read(value[:]); err == nil {
				requestID = hex.EncodeToString(value[:])
			} else {
				requestID = "unavailable"
			}
		}
		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, requestID)))
	})
}

func withRecovery(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic serving request", "request_id", requestID(r.Context()), "panic", recovered, "stack", string(debug.Stack()))
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func withLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		wrapped := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)
		logger.Info("http request",
			"request_id", requestID(r.Context()),
			"method", r.Method,
			"endpoint", r.URL.Path,
			"status_code", wrapped.status,
			"duration_ms", time.Since(started).Milliseconds(),
			"user_id", userID(r.Context()),
		)
	})
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func requireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch {
			contentType := r.Header.Get("Content-Type")
			if !strings.HasPrefix(strings.ToLower(contentType), "application/json") {
				writeError(w, http.StatusUnsupportedMediaType, "JSON_REQUIRED", "Content-Type must be application/json", nil)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		}
		next.ServeHTTP(w, r)
	})
}

func requireSameOrigin(baseURL string, next http.Handler) http.Handler {
	expected, _ := url.Parse(baseURL)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		parsed, err := url.Parse(origin)
		if err != nil || origin == "" || !strings.EqualFold(parsed.Scheme, expected.Scheme) || !strings.EqualFold(parsed.Host, expected.Host) {
			writeError(w, http.StatusForbidden, "INVALID_ORIGIN", "Request origin is not allowed", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireAdmin(logger *slog.Logger, authorizer AdminAuthorizer, cookieName string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(cookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "Authentication is required", nil)
			return
		}
		userID, err := authorizer.AuthorizeAdmin(r.Context(), cookie.Value)
		if errors.Is(err, auth.ErrUnauthorized) {
			writeError(w, http.StatusForbidden, "ADMIN_REQUIRED", "Administrator access is required", nil)
			return
		}
		if err != nil {
			logger.Error("admin authorization failed", "request_id", requestID(r.Context()), "error", err)
			writeError(w, http.StatusInternalServerError, "AUTHORIZATION_FAILED", "Authorization could not be verified", nil)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, userID)))
	})
}

type responseRecorder struct {
	http.ResponseWriter
	status int
}

func (w *responseRecorder) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func requestID(ctx context.Context) string {
	value, _ := ctx.Value(requestIDKey).(string)
	return value
}

func userID(ctx context.Context) string {
	value, _ := ctx.Value(userIDKey).(string)
	return value
}
