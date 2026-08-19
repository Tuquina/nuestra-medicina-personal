package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/nuestra-medicina-personal/backend/internal/application/authentication"
	"github.com/nuestra-medicina-personal/backend/internal/application/books"
	"github.com/nuestra-medicina-personal/backend/internal/application/library"
	"github.com/nuestra-medicina-personal/backend/internal/application/orders"
	"github.com/nuestra-medicina-personal/backend/internal/config"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/google"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/mercadopago"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/postgres"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/storage"
	"github.com/nuestra-medicina-personal/backend/internal/interfaces/httpapi"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgres.Open(ctx, cfg.DatabaseURL, cfg.MaxDBConns, cfg.DatabaseTimeout)
	if err != nil {
		return err
	}
	defer pool.Close()

	bookRepository := postgres.NewBookRepository(pool)
	bookService := books.NewService(bookRepository)
	authRepository := postgres.NewAuthRepository(pool)
	googleProvider := google.NewOIDCProvider(ctx, cfg.GoogleClientID, cfg.GoogleSecret, cfg.GoogleRedirect)
	authService := authentication.NewService(googleProvider, authRepository, cfg.AdminGoogleSub, cfg.SessionTTL)
	authorizer := postgres.NewSessionAuthorizer(pool, cfg.AdminGoogleSub)
	orderRepository := postgres.NewOrderRepository(pool)
	mercadoPagoClient := mercadopago.NewClient(cfg.MercadoPagoToken, cfg.MercadoPagoPublicBaseURL)
	orderService := orders.NewService(bookService, orderRepository, mercadoPagoClient)
	ebookStorage, err := storage.NewLocalEbookStorage(cfg.EbookStoragePath)
	if err != nil {
		return err
	}
	libraryRepository := postgres.NewLibraryRepository(pool)
	libraryService := library.NewService(libraryRepository, bookService, ebookStorage, cfg.EbookMaxUploadBytes)
	webhookValidator := mercadopago.NewWebhookValidator(cfg.MercadoPagoWebhookSecret)
	router := httpapi.NewRouter(httpapi.Dependencies{
		Logger: logger, Books: bookService, Authentication: authService, Orders: orderService, Library: libraryService,
		WebhookValidator: webhookValidator, Database: pool, AdminAuthorizer: authorizer,
		BaseURL: cfg.BaseURL, SessionCookie: cfg.SessionCookie, SecureCookies: cfg.SecureCookies(),
		EbookInternalPrefix: cfg.EbookInternalPrefix, EbookMaxUploadBytes: cfg.EbookMaxUploadBytes,
	})
	server := &http.Server{
		Addr: cfg.HTTPAddress, Handler: router, ReadTimeout: cfg.ReadTimeout,
		ReadHeaderTimeout: cfg.ReadTimeout, WriteTimeout: cfg.WriteTimeout, IdleTimeout: cfg.IdleTimeout,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("api listening", "configuration", cfg.String())
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
