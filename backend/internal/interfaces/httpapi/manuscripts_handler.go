package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type ManuscriptService interface {
	Get(context.Context, string) (manuscript.Manuscript, error)
	Save(context.Context, string, []manuscript.Chapter) (manuscript.Manuscript, error)
	Import(context.Context, string, string, []byte) (manuscript.Manuscript, error)
	Export(context.Context, string, string) ([]byte, string, error)
}

type ManuscriptHandler struct {
	service        ManuscriptService
	logger         *slog.Logger
	maxUploadBytes int64
}

func NewManuscriptHandler(service ManuscriptService, logger *slog.Logger, maxUploadBytes int64) *ManuscriptHandler {
	return &ManuscriptHandler{service: service, logger: logger, maxUploadBytes: maxUploadBytes}
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

// Import handles a multipart upload (.txt/.docx/.pdf), converts it and
// persists the result immediately — same size-limit pattern as
// LibraryHandler.Upload.
func (h *ManuscriptHandler) Import(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes+multipartOverheadAllowance)
	if err := r.ParseMultipartForm(multipartOverheadAllowance); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			writeError(w, http.StatusRequestEntityTooLarge, "MANUSCRIPT_TOO_LARGE", "Manuscript file exceeds the upload size limit", nil)
			return
		}
		writeError(w, http.StatusBadRequest, "INVALID_MANUSCRIPT_UPLOAD", "A multipart manuscript file is required", nil)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_MANUSCRIPT_UPLOAD", "A multipart manuscript file is required", nil)
		return
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_MANUSCRIPT_UPLOAD", "A multipart manuscript file is required", nil)
		return
	}
	saved, err := h.service.Import(r.Context(), r.PathValue("identifier"), header.Filename, content)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapManuscript(saved))
}

// Export streams a freshly generated EPUB or PDF back to the browser as a
// download — nothing is persisted to any storage (ADR 0004: the admin
// reviews it and attaches it manually via the existing ebook upload if
// they want it as the sellable file).
func (h *ManuscriptHandler) Export(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	data, filename, err := h.service.Export(r.Context(), r.PathValue("identifier"), format)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	contentType := "application/pdf"
	if format == "epub" {
		contentType = "application/epub+zip"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filename}))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *ManuscriptHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *manuscript.ValidationError
	switch {
	case errors.Is(err, book.ErrNotFound):
		writeError(w, http.StatusNotFound, "BOOK_NOT_FOUND", "Book not found", nil)
	case errors.Is(err, manuscript.ErrUnsupportedFormat):
		writeError(w, http.StatusUnsupportedMediaType, "MANUSCRIPT_UNSUPPORTED_FORMAT", "Unsupported manuscript file format", nil)
	case errors.Is(err, manuscript.ErrConversionFailed):
		writeError(w, http.StatusUnprocessableEntity, "MANUSCRIPT_CONVERSION_FAILED", "Manuscript file could not be converted", nil)
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
