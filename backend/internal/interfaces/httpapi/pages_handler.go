package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type PageService interface {
	Create(context.Context, page.Page) (page.Page, error)
	Get(context.Context, string) (page.Page, error)
	GetPublished(context.Context, string) (page.Page, error)
	SaveDraft(context.Context, string, page.Content) (page.Page, error)
	Publish(context.Context, string, string) (page.Page, error)
	ListVersions(context.Context, string) ([]page.Version, error)
	Restore(context.Context, string, string) (page.Page, error)
}

type PageHandler struct {
	service PageService
	logger  *slog.Logger
}

func NewPageHandler(service PageService, logger *slog.Logger) *PageHandler {
	return &PageHandler{service: service, logger: logger}
}

func (h *PageHandler) GetPublished(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.GetPublished(r.Context(), r.PathValue("slug"))
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapPublishedPage(value))
}

func (h *PageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input pageCreateInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	created, err := h.service.Create(r.Context(), page.Page{
		Type: input.Type, BookID: input.BookID, Slug: input.Slug, Title: input.Title,
		DraftContent: input.Content,
	})
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	w.Header().Set("Location", "/api/v1/admin/pages/"+created.ID)
	writeJSON(w, http.StatusCreated, mapAdminPage(created))
}

func (h *PageHandler) GetAdmin(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Get(r.Context(), r.PathValue("identifier"))
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapAdminPage(value))
}

func (h *PageHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	var input pageDraftInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	value, err := h.service.SaveDraft(r.Context(), r.PathValue("identifier"), input.Content)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapAdminPage(value))
}

func (h *PageHandler) Publish(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Publish(r.Context(), r.PathValue("identifier"), userID(r.Context()))
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapAdminPage(value))
}

func (h *PageHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	versions, err := h.service.ListVersions(r.Context(), r.PathValue("identifier"))
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	items := make([]pageVersionResponse, 0, len(versions))
	for _, version := range versions {
		items = append(items, pageVersionResponse{
			ID: version.ID, VersionNumber: version.VersionNumber, Content: version.Content,
			CreatedBy: version.CreatedBy, CreatedAt: version.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, pageVersionListResponse{Items: items, Total: len(items)})
}

func (h *PageHandler) Restore(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Restore(r.Context(), r.PathValue("identifier"), r.PathValue("versionId"))
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapAdminPage(value))
}

func (h *PageHandler) handleError(w http.ResponseWriter, r *http.Request, err error) {
	var validationError *page.ValidationError
	switch {
	case errors.Is(err, page.ErrNotFound):
		writeError(w, http.StatusNotFound, "PAGE_NOT_FOUND", "Page not found", nil)
	case errors.Is(err, page.ErrVersionNotFound):
		writeError(w, http.StatusNotFound, "PAGE_VERSION_NOT_FOUND", "Page version not found", nil)
	case errors.Is(err, page.ErrBookNotFound):
		writeError(w, http.StatusUnprocessableEntity, "PAGE_BOOK_NOT_FOUND", "Book for page does not exist", map[string]string{"bookId": "not found"})
	case errors.Is(err, page.ErrSlugConflict):
		writeError(w, http.StatusConflict, "PAGE_SLUG_CONFLICT", "A page with this slug already exists", map[string]string{"slug": "already exists"})
	case errors.Is(err, page.ErrPageExists):
		writeError(w, http.StatusConflict, "PAGE_ALREADY_EXISTS", "A page already exists for this target", nil)
	case errors.As(err, &validationError):
		writeError(w, http.StatusUnprocessableEntity, "PAGE_VALIDATION_FAILED", "Page data is invalid", validationError.Fields)
	default:
		h.logger.Error("page operation", "request_id", requestID(r.Context()), "error", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
	}
}

type pageCreateInput struct {
	Type    string       `json:"type"`
	BookID  *string      `json:"bookId"`
	Slug    string       `json:"slug"`
	Title   string       `json:"title"`
	Content page.Content `json:"content"`
}

type pageDraftInput struct {
	Content page.Content `json:"content"`
}

type publishedPageResponse struct {
	ID          string       `json:"id"`
	Type        string       `json:"type"`
	BookID      *string      `json:"bookId"`
	Slug        string       `json:"slug"`
	Title       string       `json:"title"`
	Content     page.Content `json:"content"`
	PublishedAt *time.Time   `json:"publishedAt"`
}

type adminPageResponse struct {
	ID               string        `json:"id"`
	Type             string        `json:"type"`
	BookID           *string       `json:"bookId"`
	Slug             string        `json:"slug"`
	Title            string        `json:"title"`
	Status           page.Status   `json:"status"`
	DraftContent     page.Content  `json:"draftContent"`
	PublishedContent *page.Content `json:"publishedContent"`
	CreatedAt        time.Time     `json:"createdAt"`
	UpdatedAt        time.Time     `json:"updatedAt"`
	PublishedAt      *time.Time    `json:"publishedAt"`
}

type pageVersionResponse struct {
	ID            string       `json:"id"`
	VersionNumber int          `json:"versionNumber"`
	Content       page.Content `json:"content"`
	CreatedBy     string       `json:"createdBy"`
	CreatedAt     time.Time    `json:"createdAt"`
}

type pageVersionListResponse struct {
	Items []pageVersionResponse `json:"items"`
	Total int                   `json:"total"`
}

func mapPublishedPage(value page.Page) publishedPageResponse {
	return publishedPageResponse{
		ID: value.ID, Type: value.Type, BookID: value.BookID, Slug: value.Slug,
		Title: value.Title, Content: *value.PublishedContent, PublishedAt: value.PublishedAt,
	}
}

func mapAdminPage(value page.Page) adminPageResponse {
	return adminPageResponse{
		ID: value.ID, Type: value.Type, BookID: value.BookID, Slug: value.Slug, Title: value.Title,
		Status: value.Status, DraftContent: value.DraftContent, PublishedContent: value.PublishedContent,
		CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt, PublishedAt: value.PublishedAt,
	}
}
