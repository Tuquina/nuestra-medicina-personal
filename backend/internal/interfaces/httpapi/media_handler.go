package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	mediaapp "github.com/nuestra-medicina-personal/backend/internal/application/media"
	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

type MediaService interface {
	List(context.Context) ([]mediadomain.Asset, error)
	Open(context.Context, string) (mediadomain.Asset, mediadomain.ReadSeekCloser, error)
	Upload(context.Context, string, string, io.Reader) (mediadomain.Asset, error)
	Delete(context.Context, string) error
}

type MediaHandler struct {
	service        MediaService
	logger         *slog.Logger
	maxUploadBytes int64
}

func NewMediaHandler(service MediaService, logger *slog.Logger, maxUploadBytes int64) *MediaHandler {
	return &MediaHandler{service: service, logger: logger, maxUploadBytes: maxUploadBytes}
}

func (h *MediaHandler) Get(w http.ResponseWriter, r *http.Request) {
	asset, file, err := h.service.Open(r.Context(), r.PathValue("id"))
	if errors.Is(err, mediadomain.ErrNotFound) {
		writeError(w, http.StatusNotFound, "MEDIA_NOT_FOUND", "Media not found", nil)
		return
	}
	if err != nil {
		h.internalError(w, r, "open media", err)
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", asset.MIMEType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", fmt.Sprintf("\"%s\"", asset.ID))
	http.ServeContent(w, r, asset.OriginalFilename, asset.UpdatedAt, file)
}

func (h *MediaHandler) List(w http.ResponseWriter, r *http.Request) {
	assets, err := h.service.List(r.Context())
	if err != nil {
		h.internalError(w, r, "list media", err)
		return
	}
	items := make([]mediaResponse, 0, len(assets))
	for _, asset := range assets {
		items = append(items, mapMedia(asset))
	}
	writeJSON(w, http.StatusOK, mediaListResponse{Items: items, Total: len(items)})
}

func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes+multipartOverheadAllowance)
	if err := r.ParseMultipartForm(multipartOverheadAllowance); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			writeError(w, http.StatusRequestEntityTooLarge, "MEDIA_TOO_LARGE", "Image exceeds the upload size limit", nil)
			return
		}
		writeError(w, http.StatusBadRequest, "INVALID_MEDIA_UPLOAD", "A multipart image file is required", nil)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_MEDIA_UPLOAD", "A multipart image file is required", nil)
		return
	}
	defer file.Close()
	asset, err := h.service.Upload(r.Context(), header.Filename, header.Header.Get("Content-Type"), file)
	switch {
	case errors.Is(err, mediadomain.ErrImageTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, "MEDIA_TOO_LARGE", "Image exceeds the upload size limit", nil)
	case mediaapp.IsValidationError(err):
		writeError(w, http.StatusUnprocessableEntity, "INVALID_MEDIA", "Only valid JPEG or PNG images up to 8000 pixels per side are accepted", nil)
	case err != nil:
		h.internalError(w, r, "upload media", err)
	default:
		w.Header().Set("Location", "/api/v1/media/"+asset.ID)
		writeJSON(w, http.StatusCreated, mapMedia(asset))
	}
}

func (h *MediaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	err := h.service.Delete(r.Context(), r.PathValue("id"))
	switch {
	case errors.Is(err, mediadomain.ErrNotFound):
		writeError(w, http.StatusNotFound, "MEDIA_NOT_FOUND", "Media not found", nil)
	case errors.Is(err, mediadomain.ErrInUse):
		writeError(w, http.StatusConflict, "MEDIA_IN_USE", "Media is referenced and cannot be deleted", nil)
	case err != nil:
		h.internalError(w, r, "delete media", err)
	default:
		writeJSON(w, http.StatusNoContent, nil)
	}
}

func (h *MediaHandler) internalError(w http.ResponseWriter, r *http.Request, operation string, err error) {
	h.logger.Error(operation, "request_id", requestID(r.Context()), "user_id", userID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}

type mediaResponse struct {
	ID               string    `json:"id"`
	OriginalFilename string    `json:"originalFilename"`
	MIMEType         string    `json:"mimeType"`
	SizeBytes        int64     `json:"sizeBytes"`
	Width            int       `json:"width"`
	Height           int       `json:"height"`
	URL              string    `json:"url"`
	CreatedAt        time.Time `json:"createdAt"`
}

type mediaListResponse struct {
	Items []mediaResponse `json:"items"`
	Total int             `json:"total"`
}

func mapMedia(asset mediadomain.Asset) mediaResponse {
	return mediaResponse{
		ID: asset.ID, OriginalFilename: asset.OriginalFilename, MIMEType: asset.MIMEType,
		SizeBytes: asset.SizeBytes, Width: asset.Width, Height: asset.Height,
		URL: "/api/v1/media/" + asset.ID, CreatedAt: asset.CreatedAt,
	}
}
