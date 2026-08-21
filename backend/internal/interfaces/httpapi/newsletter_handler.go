package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/nuestra-medicina-personal/backend/internal/domain/newsletter"
)

type NewsletterService interface {
	Subscribe(context.Context, string, string) (newsletter.Subscription, error)
	SetPreference(context.Context, string, string, bool) (newsletter.Subscription, error)
	GetPreference(context.Context, string) (bool, error)
}

type NewsletterHandler struct {
	service NewsletterService
	logger  *slog.Logger
}

func NewNewsletterHandler(service NewsletterService, logger *slog.Logger) *NewsletterHandler {
	return &NewsletterHandler{service: service, logger: logger}
}

func (h *NewsletterHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email  string `json:"email"`
		Source string `json:"source"`
	}
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	if _, err := h.service.Subscribe(r.Context(), input.Email, input.Source); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *NewsletterHandler) GetPreference(w http.ResponseWriter, r *http.Request) {
	subscribed, err := h.service.GetPreference(r.Context(), userID(r.Context()))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"subscribed": subscribed})
}

func (h *NewsletterHandler) SetPreference(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Subscribed bool `json:"subscribed"`
	}
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	user := currentUser(r.Context())
	if _, err := h.service.SetPreference(r.Context(), user.ID, user.Email, input.Subscribed); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"subscribed": input.Subscribed})
}

func (h *NewsletterHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *newsletter.ValidationError
	if errors.As(err, &validation) {
		writeError(w, http.StatusUnprocessableEntity, "NEWSLETTER_VALIDATION_FAILED", "Subscription data is invalid", validation.Fields)
		return
	}
	h.logger.Error("newsletter operation", "request_id", requestID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}
