package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type PageListingService interface {
	ListByType(ctx context.Context, pageType string) ([]page.Page, error)
	ListPublishedMeditations(ctx context.Context) ([]page.MeditationSummary, error)
}

// MeditationsHandler serves the public meditation list and the backoffice
// listing of repeatable pages. Each meditation itself is a regular CMS page
// (GET /api/v1/pages/{slug}, admin editing under /api/v1/admin/pages).
type MeditationsHandler struct {
	service PageListingService
	logger  *slog.Logger
}

func NewMeditationsHandler(service PageListingService, logger *slog.Logger) *MeditationsHandler {
	return &MeditationsHandler{service: service, logger: logger}
}

type meditationSummaryResponse struct {
	Slug            string  `json:"slug"`
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	ImageID         *string `json:"imageId"`
	ImageAlt        string  `json:"imageAlt"`
	DurationMinutes *int    `json:"durationMinutes"`
	HasVideo        bool    `json:"hasVideo"`
}

type pageListItemResponse struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	HasChanges  bool       `json:"hasUnpublishedChanges"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	PublishedAt *time.Time `json:"publishedAt"`
}

// ListPublished is GET /api/v1/meditations.
func (h *MeditationsHandler) ListPublished(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		writeJSON(w, http.StatusOK, map[string]any{"items": []meditationSummaryResponse{}})
		return
	}
	summaries, err := h.service.ListPublishedMeditations(r.Context())
	if err != nil {
		h.fail(w, r, err)
		return
	}
	items := make([]meditationSummaryResponse, 0, len(summaries))
	for _, summary := range summaries {
		items = append(items, meditationSummaryResponse{
			Slug: summary.Slug, Title: summary.Title, Description: summary.Description,
			ImageID: summary.ImageID, ImageAlt: summary.ImageAlt,
			DurationMinutes: summary.DurationMinutes, HasVideo: summary.HasVideo,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// ListAdmin is GET /api/v1/admin/pages?type=MEDITACION.
func (h *MeditationsHandler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		writeJSON(w, http.StatusOK, map[string]any{"items": []pageListItemResponse{}})
		return
	}
	values, err := h.service.ListByType(r.Context(), r.URL.Query().Get("type"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	items := make([]pageListItemResponse, 0, len(values))
	for _, value := range values {
		hasChanges := value.PublishedContent == nil || !sameContent(value.DraftContent, *value.PublishedContent)
		items = append(items, pageListItemResponse{
			ID: value.ID, Type: value.Type, Slug: value.Slug, Title: listTitle(value), Status: string(value.Status),
			HasChanges: hasChanges, UpdatedAt: value.UpdatedAt, PublishedAt: value.PublishedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// listTitle prefers the meditation's own (editable) title over the page's
// creation-time title.
func listTitle(value page.Page) string {
	if summary, ok := page.MeditationSummaryOf(value.Slug, value.DraftContent); ok && summary.Title != "" {
		return summary.Title
	}
	return value.Title
}

func sameContent(left, right page.Content) bool {
	if left.SchemaVersion != right.SchemaVersion || len(left.Sections) != len(right.Sections) {
		return false
	}
	for index := range left.Sections {
		a, b := left.Sections[index], right.Sections[index]
		if a.ID != b.ID || a.Type != b.Type || a.Hidden != b.Hidden || string(a.Props) != string(b.Props) {
			return false
		}
	}
	return true
}

func (h *MeditationsHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *page.ValidationError
	if errors.As(err, &validation) {
		writeError(w, http.StatusUnprocessableEntity, "PAGE_VALIDATION_FAILED", "Page listing request is invalid", validation.Fields)
		return
	}
	h.logger.Error("page listing", "request_id", requestID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}
