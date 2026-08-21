package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type ManuscriptService interface {
	Get(context.Context, string) (manuscript.Manuscript, error)
	Save(context.Context, string, []manuscript.Chapter) (manuscript.Manuscript, error)
}

type ManuscriptHandler struct {
	service ManuscriptService
	logger  *slog.Logger
}

func NewManuscriptHandler(service ManuscriptService, logger *slog.Logger) *ManuscriptHandler {
	return &ManuscriptHandler{service: service, logger: logger}
}

func (h *ManuscriptHandler) Get(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Get(r.Context(), r.PathValue("identifier"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapManuscript(value))
}

func (h *ManuscriptHandler) Save(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Chapters []manuscript.Chapter `json:"chapters"`
	}
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	saved, err := h.service.Save(r.Context(), r.PathValue("identifier"), input.Chapters)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapManuscript(saved))
}

func (h *ManuscriptHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *manuscript.ValidationError
	switch {
	case errors.Is(err, book.ErrNotFound):
		writeError(w, http.StatusNotFound, "BOOK_NOT_FOUND", "Book not found", nil)
	case errors.As(err, &validation):
		writeError(w, http.StatusUnprocessableEntity, "MANUSCRIPT_VALIDATION_FAILED", "Manuscript data is invalid", validation.Fields)
	default:
		h.logger.Error("manuscript operation", "request_id", requestID(r.Context()), "error", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
	}
}

type manuscriptResponse struct {
	BookID    string               `json:"bookId"`
	Chapters  []manuscript.Chapter `json:"chapters"`
	UpdatedAt *time.Time           `json:"updatedAt"`
}

func mapManuscript(value manuscript.Manuscript) manuscriptResponse {
	response := manuscriptResponse{BookID: value.BookID, Chapters: value.Chapters}
	if !value.UpdatedAt.IsZero() {
		response.UpdatedAt = &value.UpdatedAt
	}
	return response
}
