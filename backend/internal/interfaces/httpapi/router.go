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
	Logger              *slog.Logger
	Books               BookService
	Authentication      AuthenticationService
	Orders              OrderService
	Library             LibraryService
	Pages               PageService
	Media               MediaService
	Backoffice          BackofficeService
	WebhookValidator    MercadoPagoWebhookValidator
	Database            DatabaseHealth
	AdminAuthorizer     AdminAuthorizer
	BaseURL             string
	SessionCookie       string
	SecureCookies       bool
	EbookInternalPrefix string
	EbookMaxUploadBytes int64
	MediaMaxUploadBytes int64
}

func NewRouter(dependencies Dependencies) http.Handler {
	booksHandler := NewBookHandler(dependencies.Books, dependencies.Logger)
	authHandler := NewAuthHandler(dependencies.Authentication, dependencies.Logger, dependencies.BaseURL, dependencies.SessionCookie, dependencies.SecureCookies)
	orderHandler := NewOrderHandler(dependencies.Orders, dependencies.WebhookValidator, dependencies.Logger)
	libraryHandler := NewLibraryHandler(dependencies.Library, dependencies.Logger, dependencies.EbookInternalPrefix, dependencies.EbookMaxUploadBytes)
	pageHandler := NewPageHandler(dependencies.Pages, dependencies.Logger)
	mediaHandler := NewMediaHandler(dependencies.Media, dependencies.Logger, dependencies.MediaMaxUploadBytes)
	backofficeHandler := NewBackofficeHandler(dependencies.Backoffice, dependencies.Logger)
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
	root.HandleFunc("GET /api/v1/pages/{slug}", pageHandler.GetPublished)
	root.HandleFunc("GET /api/v1/media/{id}", mediaHandler.Get)
	root.HandleFunc("GET /api/v1/auth/google", authHandler.Start)
	root.HandleFunc("GET /api/v1/auth/google/callback", authHandler.Callback)
	root.HandleFunc("GET /api/v1/me", authHandler.Me)
	root.Handle("POST /api/v1/auth/logout", requireSameOrigin(dependencies.BaseURL, http.HandlerFunc(authHandler.Logout)))
	userOrderCreation := requireUser(dependencies.Logger, dependencies.Authentication, dependencies.SessionCookie, http.HandlerFunc(orderHandler.Create))
	root.Handle("POST /api/v1/orders", requireSameOrigin(dependencies.BaseURL, userOrderCreation))
	root.Handle("GET /api/v1/orders/{id}", requireUser(dependencies.Logger, dependencies.Authentication, dependencies.SessionCookie, http.HandlerFunc(orderHandler.Get)))
	root.Handle("GET /api/v1/me/books", requireUser(dependencies.Logger, dependencies.Authentication, dependencies.SessionCookie, http.HandlerFunc(libraryHandler.List)))
	root.Handle("GET /api/v1/books/{id}/download", requireUser(dependencies.Logger, dependencies.Authentication, dependencies.SessionCookie, http.HandlerFunc(libraryHandler.Download)))
	root.HandleFunc("POST /api/v1/webhooks/mercadopago", orderHandler.MercadoPagoWebhook)

	admin := http.NewServeMux()
	admin.HandleFunc("GET /api/v1/admin/books", booksHandler.ListAdmin)
	admin.HandleFunc("POST /api/v1/admin/books", booksHandler.Create)
	admin.HandleFunc("GET /api/v1/admin/books/{identifier}", booksHandler.GetAdmin)
	admin.HandleFunc("PUT /api/v1/admin/books/{identifier}", booksHandler.Update)
	admin.HandleFunc("DELETE /api/v1/admin/books/{identifier}", booksHandler.Archive)
	admin.HandleFunc("PUT /api/v1/admin/books/{identifier}/ebook", libraryHandler.Upload)
	admin.HandleFunc("POST /api/v1/admin/pages", pageHandler.Create)
	admin.HandleFunc("GET /api/v1/admin/pages/{identifier}", pageHandler.GetAdmin)
	admin.HandleFunc("PUT /api/v1/admin/pages/{identifier}/draft", pageHandler.SaveDraft)
	admin.HandleFunc("POST /api/v1/admin/pages/{identifier}/publish", pageHandler.Publish)
	admin.HandleFunc("GET /api/v1/admin/pages/{identifier}/versions", pageHandler.ListVersions)
	admin.HandleFunc("POST /api/v1/admin/pages/{identifier}/versions/{versionID}/restore", pageHandler.Restore)
	admin.HandleFunc("GET /api/v1/admin/media", mediaHandler.List)
	admin.HandleFunc("POST /api/v1/admin/media", mediaHandler.Upload)
	admin.HandleFunc("DELETE /api/v1/admin/media/{id}", mediaHandler.Delete)
	admin.HandleFunc("GET /api/v1/admin/dashboard", backofficeHandler.Dashboard)
	admin.HandleFunc("GET /api/v1/admin/sales", backofficeHandler.Sales)
	admin.HandleFunc("GET /api/v1/admin/customers", backofficeHandler.Customers)
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
