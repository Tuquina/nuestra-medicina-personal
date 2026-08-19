package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

type SettingsService interface {
	Get(context.Context) (settingsdomain.Settings, error)
	Update(context.Context, settingsdomain.Settings) (settingsdomain.Settings, error)
}

type IntegrationStatus struct {
	GoogleConfigured      bool
	MercadoPagoConfigured bool
	EmailConfigured       bool
}

type SettingsHandler struct {
	service      SettingsService
	logger       *slog.Logger
	integrations IntegrationStatus
}

func NewSettingsHandler(service SettingsService, logger *slog.Logger, integrations IntegrationStatus) *SettingsHandler {
	return &SettingsHandler{service: service, logger: logger, integrations: integrations}
}

func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Get(r.Context())
	if err != nil {
		h.internalError(w, r, "get site settings", err)
		return
	}
	writeJSON(w, http.StatusOK, h.mapResponse(value))
}

func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var input settingsInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	value, err := h.service.Update(r.Context(), input.toDomain())
	var validationError *settingsdomain.ValidationError
	switch {
	case errors.As(err, &validationError):
		writeError(w, http.StatusUnprocessableEntity, "SETTINGS_VALIDATION_FAILED", "Site settings are invalid", validationError.Fields)
	case err != nil:
		h.internalError(w, r, "update site settings", err)
	default:
		writeJSON(w, http.StatusOK, h.mapResponse(value))
	}
}

func (h *SettingsHandler) internalError(w http.ResponseWriter, r *http.Request, operation string, err error) {
	h.logger.Error(operation, "request_id", requestID(r.Context()), "user_id", userID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}

type settingsInput struct {
	SiteName        string `json:"siteName"`
	SiteDescription string `json:"siteDescription"`
	SupportEmail    string `json:"supportEmail"`
	NewsletterEmail string `json:"newsletterEmail"`
	SenderName      string `json:"senderName"`
	SEOTitle        string `json:"seoTitle"`
	SEODescription  string `json:"seoDescription"`
	SEOIndexable    bool   `json:"seoIndexable"`
}

func (input settingsInput) toDomain() settingsdomain.Settings {
	return settingsdomain.Settings{
		SiteName: input.SiteName, SiteDescription: input.SiteDescription,
		SupportEmail: input.SupportEmail, NewsletterEmail: input.NewsletterEmail,
		SenderName: input.SenderName, SEOTitle: input.SEOTitle,
		SEODescription: input.SEODescription, SEOIndexable: input.SEOIndexable,
	}
}

type settingsResponse struct {
	SiteName        string                       `json:"siteName"`
	SiteDescription string                       `json:"siteDescription"`
	SupportEmail    string                       `json:"supportEmail"`
	NewsletterEmail string                       `json:"newsletterEmail"`
	SenderName      string                       `json:"senderName"`
	SEOTitle        string                       `json:"seoTitle"`
	SEODescription  string                       `json:"seoDescription"`
	SEOIndexable    bool                         `json:"seoIndexable"`
	Integrations    settingsIntegrationsResponse `json:"integrations"`
	UpdatedAt       time.Time                    `json:"updatedAt"`
}

type settingsIntegrationsResponse struct {
	Google      integrationResponse `json:"google"`
	MercadoPago integrationResponse `json:"mercadoPago"`
	Email       integrationResponse `json:"email"`
}

type integrationResponse struct {
	Configured bool `json:"configured"`
}

func (h *SettingsHandler) mapResponse(value settingsdomain.Settings) settingsResponse {
	return settingsResponse{
		SiteName: value.SiteName, SiteDescription: value.SiteDescription,
		SupportEmail: value.SupportEmail, NewsletterEmail: value.NewsletterEmail,
		SenderName: value.SenderName, SEOTitle: value.SEOTitle,
		SEODescription: value.SEODescription, SEOIndexable: value.SEOIndexable,
		Integrations: settingsIntegrationsResponse{
			Google:      integrationResponse{Configured: h.integrations.GoogleConfigured},
			MercadoPago: integrationResponse{Configured: h.integrations.MercadoPagoConfigured},
			Email:       integrationResponse{Configured: h.integrations.EmailConfigured},
		},
		UpdatedAt: value.UpdatedAt,
	}
}
