package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

type DatabaseHealth interface {
	Ping(context.Context) error
}

type Dependencies struct {
	Logger          *slog.Logger
	Books           BookService
	Authentication  AuthenticationService
	Database        DatabaseHealth
	AdminAuthorizer AdminAuthorizer
	BaseURL         string
	SessionCookie   string
	SecureCookies   bool
}

func NewRouter(dependencies Dependencies) http.Handler {
	booksHandler := NewBookHandler(dependencies.Books, dependencies.Logger)
	authHandler := NewAuthHandler(dependencies.Authentication, dependencies.Logger, dependencies.BaseURL, dependencies.SessionCookie, dependencies.SecureCookies)
	root := http.NewServeMux()
	root.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	root.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := dependencies.Database.Ping(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "DATABASE_UNAVAILABLE", "Database is not ready", nil)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	root.HandleFunc("GET /api/v1/books", booksHandler.ListPublished)
	root.HandleFunc("GET /api/v1/books/{slug}", booksHandler.GetPublished)
	root.HandleFunc("GET /api/v1/auth/google", authHandler.Start)
	root.HandleFunc("GET /api/v1/auth/google/callback", authHandler.Callback)
	root.HandleFunc("GET /api/v1/me", authHandler.Me)
	root.Handle("POST /api/v1/auth/logout", requireSameOrigin(dependencies.BaseURL, http.HandlerFunc(authHandler.Logout)))

	admin := http.NewServeMux()
	admin.HandleFunc("GET /api/v1/admin/books", booksHandler.ListAdmin)
	admin.HandleFunc("POST /api/v1/admin/books", booksHandler.Create)
	admin.HandleFunc("GET /api/v1/admin/books/{identifier}", booksHandler.GetAdmin)
	admin.HandleFunc("PUT /api/v1/admin/books/{identifier}", booksHandler.Update)
	admin.HandleFunc("DELETE /api/v1/admin/books/{identifier}", booksHandler.Archive)
	adminHandler := requireSameOrigin(dependencies.BaseURL,
		requireAdmin(dependencies.Logger, dependencies.AdminAuthorizer, dependencies.SessionCookie, admin))
	root.Handle("/api/v1/admin/", adminHandler)

	var handler http.Handler = root
	handler = requireJSON(handler)
	handler = withLogging(dependencies.Logger, handler)
	handler = withRecovery(dependencies.Logger, handler)
	handler = withRequestID(handler)
	handler = withSecurityHeaders(handler)
	return handler
}
