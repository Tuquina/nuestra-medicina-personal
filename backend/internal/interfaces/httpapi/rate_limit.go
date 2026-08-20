package httpapi

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxRateLimitEntries = 10_000

type RateLimitConfig struct {
	Window             time.Duration
	AuthRequests       int
	OrderRequests      int
	DownloadRequests   int
	AdminWriteRequests int
	TrustProxyHeaders  bool
}

type rateLimitEntry struct {
	count   int
	resetAt time.Time
}

type RateLimiter struct {
	config      RateLimitConfig
	mu          sync.Mutex
	entries     map[string]rateLimitEntry
	nextCleanup time.Time
	now         func() time.Time
}

func NewRateLimiter(config RateLimitConfig) *RateLimiter {
	return &RateLimiter{config: config, entries: make(map[string]rateLimitEntry), now: time.Now}
}

func (limiter *RateLimiter) Auth(next http.Handler) http.Handler {
	return limiter.limit("auth", limiter.config.AuthRequests, clientIdentity(limiter.config.TrustProxyHeaders), false, next)
}

func (limiter *RateLimiter) Orders(next http.Handler) http.Handler {
	return limiter.limit("orders", limiter.config.OrderRequests, authenticatedIdentity, false, next)
}

func (limiter *RateLimiter) Downloads(next http.Handler) http.Handler {
	return limiter.limit("downloads", limiter.config.DownloadRequests, authenticatedIdentity, false, next)
}

func (limiter *RateLimiter) AdminWrites(next http.Handler) http.Handler {
	return limiter.limit("admin-writes", limiter.config.AdminWriteRequests, authenticatedIdentity, true, next)
}

type rateLimitKey func(*http.Request) string

func (limiter *RateLimiter) limit(scope string, maximum int, key rateLimitKey, writesOnly bool, next http.Handler) http.Handler {
	if maximum < 1 || limiter.config.Window <= 0 {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if writesOnly && (r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions) {
			next.ServeHTTP(w, r)
			return
		}
		now := limiter.now().UTC()
		allowed, remaining, resetAt := limiter.allow(scope+":"+key(r), maximum, now)
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(maximum))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		if !allowed {
			retryAfter := int(resetAt.Sub(now).Seconds())
			if resetAt.After(now.Add(time.Duration(retryAfter) * time.Second)) {
				retryAfter++
			}
			if retryAfter < 1 {
				retryAfter = 1
			}
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			writeError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (limiter *RateLimiter) allow(key string, maximum int, now time.Time) (bool, int, time.Time) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if limiter.nextCleanup.IsZero() || !now.Before(limiter.nextCleanup) {
		for candidate, entry := range limiter.entries {
			if !now.Before(entry.resetAt) {
				delete(limiter.entries, candidate)
			}
		}
		limiter.nextCleanup = now.Add(limiter.config.Window)
	}
	entry, exists := limiter.entries[key]
	if !exists && len(limiter.entries) >= maxRateLimitEntries-1 {
		key = "overflow"
		entry, exists = limiter.entries[key]
	}
	if !exists || !now.Before(entry.resetAt) {
		entry = rateLimitEntry{resetAt: now.Add(limiter.config.Window)}
	}
	if entry.count >= maximum {
		return false, 0, entry.resetAt
	}
	entry.count++
	limiter.entries[key] = entry
	return true, maximum - entry.count, entry.resetAt
}

func clientIdentity(trustProxyHeaders bool) rateLimitKey {
	return func(r *http.Request) string {
		if trustProxyHeaders {
			candidate := strings.TrimSpace(r.Header.Get("X-Real-IP"))
			if parsed := net.ParseIP(candidate); parsed != nil {
				return parsed.String()
			}
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err == nil {
			if parsed := net.ParseIP(host); parsed != nil {
				return parsed.String()
			}
		}
		if parsed := net.ParseIP(r.RemoteAddr); parsed != nil {
			return parsed.String()
		}
		return "unknown"
	}
}

func authenticatedIdentity(r *http.Request) string {
	if identity := userID(r.Context()); identity != "" {
		return identity
	}
	return "unauthenticated"
}
