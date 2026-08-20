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
	requestIDKey       contextKey = "request_id"
	userIDKey          contextKey = "user_id"
	currentUserKey     contextKey = "current_user"
	requestLogStateKey contextKey = "request_log_state"
)

type requestLogState struct {
	userID string
}

type AdminAuthorizer interface {
	AuthorizeAdmin(context.Context, string) (string, error)
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if !validRequestID(requestID) {
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

func validRequestID(value string) bool {
	if value == "" || len(value) > 64 {
		return false
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') && (character < 'A' || character > 'Z') &&
			(character < '0' || character > '9') && character != '-' && character != '_' && character != '.' {
			return false
		}
	}
	return true
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
		state := &requestLogState{}
		r = r.WithContext(context.WithValue(r.Context(), requestLogStateKey, state))
		wrapped := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)
		endpoint := r.Pattern
		if endpoint == "" {
			endpoint = "unmatched"
		}
		logger.Info("http request",
			"request_id", requestID(r.Context()),
			"method", r.Method,
			"endpoint", endpoint,
			"status_code", wrapped.status,
			"duration_ms", time.Since(started).Milliseconds(),
			"response_bytes", wrapped.bytes,
			"user_id", state.userID,
		)
	})
}

func withSecurityHeaders(secure bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		if secure {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

func limitRequestTarget(maximum int, next http.Handler) http.Handler {
	if maximum < 1 {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.RequestURI) > maximum {
			writeError(w, http.StatusRequestURITooLong, "REQUEST_URI_TOO_LONG", "Request URI is too long", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch) && r.ContentLength != 0 {
			contentType := r.Header.Get("Content-Type")
			lowerContentType := strings.ToLower(contentType)
			switch {
			case strings.HasPrefix(lowerContentType, "application/json"):
				r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			case strings.HasPrefix(lowerContentType, "multipart/form-data"):
				// Upload handlers apply their own task-specific limits.
			default:
				writeError(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json or multipart/form-data", nil)
				return
			}
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
		setRequestUserID(r.Context(), userID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, userID)))
	})
}

func requireUser(logger *slog.Logger, authentication AuthenticationService, cookieName string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(cookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "Authentication is required", nil)
			return
		}
		user, err := authentication.CurrentUser(r.Context(), cookie.Value)
		if errors.Is(err, auth.ErrUnauthorized) {
			writeError(w, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "Authentication is required", nil)
			return
		}
		if err != nil {
			logger.Error("user authentication failed", "request_id", requestID(r.Context()), "error", err)
			writeError(w, http.StatusInternalServerError, "AUTHENTICATION_FAILED", "Authentication could not be verified", nil)
			return
		}
		setRequestUserID(r.Context(), user.ID)
		ctx := context.WithValue(r.Context(), userIDKey, user.ID)
		ctx = context.WithValue(ctx, currentUserKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type responseRecorder struct {
	http.ResponseWriter
	status      int
	bytes       int
	wroteHeader bool
}

func (w *responseRecorder) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseRecorder) Write(value []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	written, err := w.ResponseWriter.Write(value)
	w.bytes += written
	return written, err
}

func setRequestUserID(ctx context.Context, value string) {
	if state, ok := ctx.Value(requestLogStateKey).(*requestLogState); ok {
		state.userID = value
	}
}

func requestID(ctx context.Context) string {
	value, _ := ctx.Value(requestIDKey).(string)
	return value
}

func userID(ctx context.Context) string {
	value, _ := ctx.Value(userIDKey).(string)
	return value
}

func currentUser(ctx context.Context) auth.User {
	value, _ := ctx.Value(currentUserKey).(auth.User)
	return value
}
