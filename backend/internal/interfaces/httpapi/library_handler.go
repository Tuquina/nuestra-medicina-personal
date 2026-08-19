package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"

	libraryapp "github.com/nuestra-medicina-personal/backend/internal/application/library"
	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
)

const multipartOverheadAllowance = int64(1 << 20)

type LibraryService interface {
	List(context.Context, string) ([]librarydomain.Book, error)
	Download(context.Context, string, string) (librarydomain.Download, error)
	Upload(context.Context, string, string, string, libraryapp.UploadFile) (librarydomain.StoredEbook, error)
}

type LibraryHandler struct {
	service        LibraryService
	logger         *slog.Logger
	internalPrefix string
	maxUploadBytes int64
}

func NewLibraryHandler(service LibraryService, logger *slog.Logger, internalPrefix string, maxUploadBytes int64) *LibraryHandler {
	return &LibraryHandler{
		service: service, logger: logger,
		internalPrefix: strings.TrimRight(internalPrefix, "/"), maxUploadBytes: maxUploadBytes,
	}
}

func (h *LibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context(), userID(r.Context()))
	if err != nil {
		h.internalError(w, r, "list user library", err)
		return
	}
	response := libraryListResponse{Items: make([]libraryBookResponse, 0, len(items)), Total: len(items)}
	for _, item := range items {
		response.Items = append(response.Items, libraryBookResponse{
			ID: item.ID, Slug: item.Slug, Title: item.Title, CoverMediaID: item.CoverMediaID,
			Format: item.Format, FileSizeBytes: item.FileSizeBytes, PurchasedAt: item.PurchasedAt,
			DownloadAvailable: item.DownloadAvailable,
		})
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *LibraryHandler) Download(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Download(r.Context(), userID(r.Context()), r.PathValue("id"))
	if errors.Is(err, librarydomain.ErrBookNotAvailable) {
		writeError(w, http.StatusNotFound, "EBOOK_NOT_AVAILABLE", "Ebook is not available", nil)
		return
	}
	if err != nil {
		h.internalError(w, r, "authorize ebook download", err)
		return
	}
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": value.Filename})
	w.Header().Set("Content-Type", value.MediaType)
	w.Header().Set("Content-Disposition", disposition)
	w.Header().Set("X-Accel-Redirect", h.internalPrefix+"/"+url.PathEscape(value.StorageKey))
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(http.StatusOK)
}

func (h *LibraryHandler) Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes+multipartOverheadAllowance)
	if err := r.ParseMultipartForm(multipartOverheadAllowance); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			writeError(w, http.StatusRequestEntityTooLarge, "EBOOK_TOO_LARGE", "Ebook exceeds the upload size limit", nil)
			return
		}
		writeError(w, http.StatusBadRequest, "INVALID_EBOOK_UPLOAD", "A multipart ebook file is required", nil)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_EBOOK_UPLOAD", "A multipart ebook file is required", nil)
		return
	}
	defer file.Close()

	stored, err := h.service.Upload(
		r.Context(), r.PathValue("identifier"), header.Filename,
		header.Header.Get("Content-Type"), file,
	)
	switch {
	case errors.Is(err, book.ErrNotFound):
		writeError(w, http.StatusNotFound, "BOOK_NOT_FOUND", "Book not found", nil)
	case errors.Is(err, librarydomain.ErrInvalidEbook):
		writeError(w, http.StatusUnprocessableEntity, "INVALID_EBOOK", "Only valid PDF or EPUB files are accepted", nil)
	case errors.Is(err, librarydomain.ErrEbookTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, "EBOOK_TOO_LARGE", "Ebook exceeds the upload size limit", nil)
	case err != nil:
		h.internalError(w, r, "upload ebook", err)
	default:
		writeJSON(w, http.StatusOK, ebookUploadResponse{
			BookID: stored.BookID, Filename: stored.Filename,
			MediaType: stored.MediaType, SizeBytes: stored.SizeBytes,
		})
	}
}

func (h *LibraryHandler) internalError(w http.ResponseWriter, r *http.Request, operation string, err error) {
	h.logger.Error(operation, "request_id", requestID(r.Context()), "user_id", userID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}

type libraryBookResponse struct {
	ID                string    `json:"id"`
	Slug              string    `json:"slug"`
	Title             string    `json:"title"`
	CoverMediaID      *string   `json:"coverMediaId"`
	Format            string    `json:"format"`
	FileSizeBytes     *int64    `json:"fileSizeBytes"`
	PurchasedAt       time.Time `json:"purchasedAt"`
	DownloadAvailable bool      `json:"downloadAvailable"`
}

type libraryListResponse struct {
	Items []libraryBookResponse `json:"items"`
	Total int                   `json:"total"`
}

type ebookUploadResponse struct {
	BookID    string `json:"bookId"`
	Filename  string `json:"filename"`
	MediaType string `json:"mediaType"`
	SizeBytes int64  `json:"sizeBytes"`
}
