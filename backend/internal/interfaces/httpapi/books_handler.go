package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

type BookService interface {
	ListPublished(context.Context) ([]book.Book, error)
	GetPublishedBySlug(context.Context, string) (book.Book, error)
	ListAll(context.Context) ([]book.Book, error)
	Get(context.Context, string) (book.Book, error)
	Create(context.Context, book.Book) (book.Book, error)
	Update(context.Context, string, book.Book) (book.Book, error)
	Archive(context.Context, string) error
}

type BookHandler struct {
	service BookService
	logger  *slog.Logger
}

func NewBookHandler(service BookService, logger *slog.Logger) *BookHandler {
	return &BookHandler{service: service, logger: logger}
}

func (h *BookHandler) ListPublished(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListPublished(r.Context())
	if err != nil {
		h.internalError(w, r, "list published books", err)
		return
	}
	writeJSON(w, http.StatusOK, bookListResponse{Items: mapBooks(items), Total: len(items)})
}

func (h *BookHandler) GetPublished(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.GetPublishedBySlug(r.Context(), r.PathValue("slug"))
	if err != nil {
		h.handleBookError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapBook(item))
}

func (h *BookHandler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListAll(r.Context())
	if err != nil {
		h.internalError(w, r, "list admin books", err)
		return
	}
	writeJSON(w, http.StatusOK, bookListResponse{Items: mapBooks(items), Total: len(items)})
}

func (h *BookHandler) GetAdmin(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.Get(r.Context(), r.PathValue("identifier"))
	if err != nil {
		h.handleBookError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapBook(item))
}

func (h *BookHandler) Create(w http.ResponseWriter, r *http.Request) {
	value, ok := h.decodeBookInput(w, r)
	if !ok {
		return
	}
	created, err := h.service.Create(r.Context(), value)
	if err != nil {
		h.handleBookError(w, r, err)
		return
	}
	w.Header().Set("Location", "/api/v1/admin/books/"+created.ID)
	writeJSON(w, http.StatusCreated, mapBook(created))
}

func (h *BookHandler) Update(w http.ResponseWriter, r *http.Request) {
	value, ok := h.decodeBookInput(w, r)
	if !ok {
		return
	}
	updated, err := h.service.Update(r.Context(), r.PathValue("identifier"), value)
	if err != nil {
		h.handleBookError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapBook(updated))
}

func (h *BookHandler) Archive(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Archive(r.Context(), r.PathValue("identifier")); err != nil {
		h.handleBookError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *BookHandler) decodeBookInput(w http.ResponseWriter, r *http.Request) (book.Book, bool) {
	var input bookInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return book.Book{}, false
	}
	value, err := input.toDomain()
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "BOOK_VALIDATION_FAILED", "Book data is invalid", map[string]string{"publicationDate": err.Error()})
		return book.Book{}, false
	}
	return value, true
}

func (h *BookHandler) handleBookError(w http.ResponseWriter, r *http.Request, err error) {
	var validationError *book.ValidationError
	switch {
	case errors.Is(err, book.ErrNotFound):
		writeError(w, http.StatusNotFound, "BOOK_NOT_FOUND", "Book not found", nil)
	case errors.Is(err, book.ErrSlugConflict):
		writeError(w, http.StatusConflict, "BOOK_SLUG_CONFLICT", "A book with this slug already exists", map[string]string{"slug": "already exists"})
	case errors.As(err, &validationError):
		writeError(w, http.StatusUnprocessableEntity, "BOOK_VALIDATION_FAILED", "Book data is invalid", validationError.Fields)
	default:
		h.internalError(w, r, "book operation", err)
	}
}

func (h *BookHandler) internalError(w http.ResponseWriter, r *http.Request, operation string, err error) {
	h.logger.Error(operation, "request_id", requestID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}

type bookInput struct {
	Slug                 string      `json:"slug"`
	Title                string      `json:"title"`
	Subtitle             string      `json:"subtitle"`
	AuthorName           string      `json:"authorName"`
	Category             string      `json:"category"`
	Variant              string      `json:"variant"`
	ShortDescription     string      `json:"shortDescription"`
	PriceMinorUnits      int64       `json:"priceMinorUnits"`
	Currency             string      `json:"currency"`
	ISBN                 string      `json:"isbn"`
	PublicationDate      *string     `json:"publicationDate"`
	PublicationDateLabel string      `json:"publicationDateLabel"`
	Format               string      `json:"format"`
	FileSizeBytes        *int64      `json:"fileSizeBytes"`
	CoverMediaID         *string     `json:"coverMediaId"`
	CoverCaption         string      `json:"coverCaption"`
	Status               book.Status `json:"status"`
	SEOTitle             string      `json:"seoTitle"`
	SEODescription       string      `json:"seoDescription"`
	SEOIndexable         bool        `json:"seoIndexable"`
}

func (input bookInput) toDomain() (book.Book, error) {
	var publicationDate *time.Time
	if input.PublicationDate != nil && *input.PublicationDate != "" {
		parsed, err := time.Parse("2006-01-02", *input.PublicationDate)
		if err != nil {
			return book.Book{}, errors.New("must use YYYY-MM-DD format")
		}
		publicationDate = &parsed
	}
	return book.Book{
		Slug: input.Slug, Title: input.Title, Subtitle: input.Subtitle,
		AuthorName: input.AuthorName, Category: input.Category, Variant: input.Variant,
		ShortDescription: input.ShortDescription, PriceMinorUnits: input.PriceMinorUnits,
		Currency: input.Currency, ISBN: input.ISBN, PublicationDate: publicationDate,
		PublicationDateLabel: input.PublicationDateLabel, Format: input.Format,
		FileSizeBytes: input.FileSizeBytes, CoverMediaID: input.CoverMediaID,
		CoverCaption: input.CoverCaption,
		Status:       input.Status, SEOTitle: input.SEOTitle, SEODescription: input.SEODescription,
		SEOIndexable: input.SEOIndexable,
	}, nil
}

type bookResponse struct {
	ID                   string      `json:"id"`
	Slug                 string      `json:"slug"`
	Title                string      `json:"title"`
	Subtitle             string      `json:"subtitle"`
	AuthorName           string      `json:"authorName"`
	Category             string      `json:"category"`
	Variant              string      `json:"variant"`
	ShortDescription     string      `json:"shortDescription"`
	PriceMinorUnits      int64       `json:"priceMinorUnits"`
	Currency             string      `json:"currency"`
	ISBN                 string      `json:"isbn"`
	PublicationDate      *string     `json:"publicationDate"`
	PublicationDateLabel string      `json:"publicationDateLabel"`
	Format               string      `json:"format"`
	FileSizeBytes        *int64      `json:"fileSizeBytes"`
	CoverMediaID         *string     `json:"coverMediaId"`
	CoverCaption         string      `json:"coverCaption"`
	HasCover             bool        `json:"hasCover"`
	Status               book.Status `json:"status"`
	SEOTitle             string      `json:"seoTitle"`
	SEODescription       string      `json:"seoDescription"`
	SEOIndexable         bool        `json:"seoIndexable"`
	CreatedAt            time.Time   `json:"createdAt"`
	UpdatedAt            time.Time   `json:"updatedAt"`
	PublishedAt          *time.Time  `json:"publishedAt"`
}

type bookListResponse struct {
	Items []bookResponse `json:"items"`
	Total int            `json:"total"`
}

func mapBooks(values []book.Book) []bookResponse {
	items := make([]bookResponse, 0, len(values))
	for _, value := range values {
		items = append(items, mapBook(value))
	}
	return items
}

func mapBook(value book.Book) bookResponse {
	var publicationDate *string
	if value.PublicationDate != nil {
		formatted := value.PublicationDate.Format("2006-01-02")
		publicationDate = &formatted
	}
	return bookResponse{
		ID: value.ID, Slug: value.Slug, Title: value.Title, Subtitle: value.Subtitle,
		AuthorName: value.AuthorName, Category: value.Category, Variant: value.Variant,
		ShortDescription: value.ShortDescription, PriceMinorUnits: value.PriceMinorUnits,
		Currency: value.Currency, ISBN: value.ISBN, PublicationDate: publicationDate,
		PublicationDateLabel: value.PublicationDateLabel, Format: value.Format,
		FileSizeBytes: value.FileSizeBytes, CoverMediaID: value.CoverMediaID,
		CoverCaption: value.CoverCaption, HasCover: value.CoverMediaID != nil,
		Status: value.Status, SEOTitle: value.SEOTitle, SEODescription: value.SEODescription,
		SEOIndexable: value.SEOIndexable, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt,
		PublishedAt: value.PublishedAt,
	}
}
