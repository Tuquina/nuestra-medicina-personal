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
	"github.com/nuestra-medicina-personal/backend/internal/application/backoffice"
	"github.com/nuestra-medicina-personal/backend/internal/application/books"
	"github.com/nuestra-medicina-personal/backend/internal/application/coupons"
	emailapp "github.com/nuestra-medicina-personal/backend/internal/application/email"
	"github.com/nuestra-medicina-personal/backend/internal/application/library"
	"github.com/nuestra-medicina-personal/backend/internal/application/manuscripts"
	mediaapp "github.com/nuestra-medicina-personal/backend/internal/application/media"
	"github.com/nuestra-medicina-personal/backend/internal/application/newsletter"
	"github.com/nuestra-medicina-personal/backend/internal/application/orders"
	"github.com/nuestra-medicina-personal/backend/internal/application/pages"
	"github.com/nuestra-medicina-personal/backend/internal/application/reviews"
	settingsapp "github.com/nuestra-medicina-personal/backend/internal/application/settings"
	"github.com/nuestra-medicina-personal/backend/internal/config"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/gmail"
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
	logger.Info("api starting",
		"environment", cfg.Environment, "http_address", cfg.HTTPAddress,
		"google_configured", cfg.GoogleClientID != "" && cfg.GoogleSecret != "" && cfg.GoogleRedirect != "",
		"mercado_pago_configured", cfg.MercadoPagoToken != "" && cfg.MercadoPagoWebhookSecret != "" && cfg.MercadoPagoPublicBaseURL != "",
		"email_configured", cfg.GoogleMailCredentials != "" && cfg.GoogleMailSender != "",
	)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgres.Open(ctx, cfg.DatabaseURL, cfg.MaxDBConns, cfg.DatabaseTimeout)
	if err != nil {
		return err
	}
	defer pool.Close()

	bookRepository := postgres.NewBookRepository(pool)
	bookService := books.NewService(bookRepository)
	couponRepository := postgres.NewCouponRepository(pool)
	couponService := coupons.NewService(couponRepository)
	reviewRepository := postgres.NewReviewRepository(pool)
	reviewService := reviews.NewService(reviewRepository)
	newsletterRepository := postgres.NewNewsletterRepository(pool)
	newsletterService := newsletter.NewService(newsletterRepository)
	authRepository := postgres.NewAuthRepository(pool)
	googleProvider := google.NewOIDCProvider(ctx, cfg.GoogleClientID, cfg.GoogleSecret, cfg.GoogleRedirect)
	authService := authentication.NewService(googleProvider, authRepository, cfg.AdminGoogleSub, cfg.SessionTTL)
	authorizer := postgres.NewSessionAuthorizer(pool, cfg.AdminGoogleSub)
	orderRepository := postgres.NewOrderRepository(pool)
	mercadoPagoClient := mercadopago.NewClient(cfg.MercadoPagoToken, cfg.MercadoPagoPublicBaseURL)
	orderService := orders.NewService(bookService, couponRepository, orderRepository, mercadoPagoClient)
	ebookStorage, err := storage.NewLocalEbookStorage(cfg.EbookStoragePath)
	if err != nil {
		return err
	}
	libraryRepository := postgres.NewLibraryRepository(pool)
	libraryService := library.NewService(libraryRepository, bookService, ebookStorage, cfg.EbookMaxUploadBytes)
	manuscriptRepository := postgres.NewManuscriptRepository(pool)
	manuscriptService := manuscripts.NewService(manuscriptRepository, bookService)
	pageRepository := postgres.NewPageRepository(pool)
	pageService := pages.NewService(pageRepository)
	mediaStorage, err := storage.NewLocalMediaStorage(cfg.MediaStoragePath)
	if err != nil {
		return err
	}
	mediaRepository := postgres.NewMediaRepository(pool)
	mediaService := mediaapp.NewService(mediaRepository, mediaStorage, cfg.MediaMaxUploadBytes)
	backofficeRepository := postgres.NewBackofficeRepository(pool)
	backofficeService := backoffice.NewService(backofficeRepository, cfg.AdminGoogleSub)
	settingsRepository := postgres.NewSettingsRepository(pool)
	settingsService := settingsapp.NewService(settingsRepository)
	emailRenderer, err := emailapp.NewRenderer(cfg.BaseURL, cfg.SupportEmail)
	if err != nil {
		return err
	}
	gmailClient, err := gmail.NewClient(cfg.GoogleMailCredentials, cfg.GoogleMailSender)
	if err != nil {
		return err
	}
	emailRepository := postgres.NewEmailRepository(pool)
	emailWorker := emailapp.NewWorker(
		emailRepository, gmailClient, emailRenderer, logger,
		cfg.EmailWorkerInterval, cfg.EmailLeaseTimeout, cfg.EmailBatchSize, cfg.EmailMaxAttempts,
	)
	if gmailClient.Configured() {
		go emailWorker.Run(ctx)
		logger.Info("transactional email worker enabled", "sender", cfg.GoogleMailSender)
	} else {
		logger.Info("transactional email worker disabled")
	}
	webhookValidator := mercadopago.NewWebhookValidator(cfg.MercadoPagoWebhookSecret)
	router := httpapi.NewRouter(httpapi.Dependencies{
		Logger: logger, Books: bookService, Coupons: couponService, Reviews: reviewService, Newsletter: newsletterService, Authentication: authService, Orders: orderService, Library: libraryService, Manuscripts: manuscriptService, Pages: pageService, Media: mediaService, Backoffice: backofficeService, Settings: settingsService,
		IntegrationStatus: httpapi.IntegrationStatus{
			GoogleConfigured:      cfg.GoogleClientID != "" && cfg.GoogleSecret != "" && cfg.GoogleRedirect != "",
			MercadoPagoConfigured: cfg.MercadoPagoToken != "" && cfg.MercadoPagoWebhookSecret != "" && cfg.MercadoPagoPublicBaseURL != "",
			EmailConfigured:       cfg.GoogleMailCredentials != "" && cfg.GoogleMailSender != "",
		},
		WebhookValidator: webhookValidator, Database: pool, AdminAuthorizer: authorizer,
		BaseURL: cfg.BaseURL, SessionCookie: cfg.SessionCookie, SecureCookies: cfg.SecureCookies(),
		EbookInternalPrefix: cfg.EbookInternalPrefix, EbookMaxUploadBytes: cfg.EbookMaxUploadBytes,
		MediaMaxUploadBytes: cfg.MediaMaxUploadBytes, ManuscriptMaxUploadBytes: cfg.ManuscriptMaxUploadBytes,
		RateLimits: httpapi.RateLimitConfig{
			Window: cfg.RateLimitWindow, AuthRequests: cfg.RateLimitAuthRequests,
			OrderRequests: cfg.RateLimitOrderRequests, DownloadRequests: cfg.RateLimitDownloadRequests,
			AdminWriteRequests: cfg.RateLimitAdminWrites, TrustProxyHeaders: cfg.TrustProxyHeaders,
		},
		MaxRequestURIBytes: cfg.MaxRequestURIBytes,
	})
	server := &http.Server{
		Addr: cfg.HTTPAddress, Handler: router, ReadTimeout: cfg.ReadTimeout,
		ReadHeaderTimeout: cfg.ReadTimeout, WriteTimeout: cfg.WriteTimeout, IdleTimeout: cfg.IdleTimeout,
		MaxHeaderBytes: cfg.MaxHeaderBytes,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("api listening", "http_address", cfg.HTTPAddress)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		logger.Info("api shutdown requested")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return err
		}
		logger.Info("api shutdown complete")
		return nil
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
