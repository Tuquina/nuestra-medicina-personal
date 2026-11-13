package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/application/toolentries"
	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
)

type ToolEntriesService interface {
	Enabled() bool
	List(ctx context.Context, userID, tool string, after *toolentry.Cursor, limit int) (toolentries.Page, error)
	Put(ctx context.Context, userID string, ref toolentry.Ref, data json.RawMessage, revision int64) (toolentry.Entry, error)
	Delete(ctx context.Context, userID string, ref toolentry.Ref) error
	DeleteAll(ctx context.Context, userID, tool, kind string) error
}

// ToolEntriesHandler serves /api/v1/me/tools/*: the signed-in person's own
// Herramientas entries, encrypted at rest (ADR 0006). There is deliberately
// no admin counterpart — nobody but the owner can read these.
type ToolEntriesHandler struct {
	service ToolEntriesService
	logger  *slog.Logger
	// available is false when storage isn't configured, or under the local
	// debug bypass, whose synthetic identity can't own data.
	available bool
}

func NewToolEntriesHandler(service ToolEntriesService, logger *slog.Logger, localDebugAuth bool) *ToolEntriesHandler {
	return &ToolEntriesHandler{
		service: service, logger: logger,
		available: service != nil && service.Enabled() && !localDebugAuth,
	}
}

type toolEntryResponse struct {
	Kind      string          `json:"kind"`
	Key       string          `json:"key"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

func newToolEntryResponse(entry toolentry.Entry) toolEntryResponse {
	return toolEntryResponse{Kind: entry.Kind, Key: entry.Key, Data: entry.Data, CreatedAt: entry.CreatedAt, UpdatedAt: entry.UpdatedAt}
}

func (h *ToolEntriesHandler) List(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	tool := r.PathValue("tool")
	cursor, err := toolentry.ParseCursor(tool, r.URL.Query().Get("cursor"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	limit := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			writeError(w, http.StatusUnprocessableEntity, "TOOL_ENTRY_VALIDATION_FAILED", "Tool entry request is invalid",
				map[string]string{"limit": "must be a positive integer"})
			return
		}
		limit = parsed
	}
	page, err := h.service.List(r.Context(), userID(r.Context()), tool, cursor, limit)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	entries := make([]toolEntryResponse, 0, len(page.Entries))
	for _, entry := range page.Entries {
		entries = append(entries, newToolEntryResponse(entry))
	}
	var next *string
	if page.Next != nil {
		value := page.Next.String()
		next = &value
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "nextCursor": next})
}

func (h *ToolEntriesHandler) Put(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	var input struct {
		Data json.RawMessage `json:"data"`
		// Revision increases with every edit of the entry; stale writes get 409.
		Revision int64 `json:"revision"`
	}
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	entry, err := h.service.Put(r.Context(), userID(r.Context()), refFromPath(r), input.Data, input.Revision)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, newToolEntryResponse(entry))
}

func (h *ToolEntriesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	if err := h.service.Delete(r.Context(), userID(r.Context()), refFromPath(r)); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *ToolEntriesHandler) DeleteAll(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	if err := h.service.DeleteAll(r.Context(), userID(r.Context()), r.PathValue("tool"), r.URL.Query().Get("kind")); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// ready marks every response as uncacheable (it may carry personal
// writing) and rejects requests when account storage is unavailable.
func (h *ToolEntriesHandler) ready(w http.ResponseWriter) bool {
	w.Header().Set("Cache-Control", "no-store")
	if !h.available {
		writeError(w, http.StatusServiceUnavailable, "PERSONAL_STORAGE_UNAVAILABLE", "Account storage for tools is not available", nil)
		return false
	}
	return true
}

func refFromPath(r *http.Request) toolentry.Ref {
	return toolentry.Ref{Tool: r.PathValue("tool"), Kind: r.PathValue("kind"), Key: r.PathValue("key")}
}

func (h *ToolEntriesHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *toolentry.ValidationError
	switch {
	case errors.As(err, &validation):
		writeError(w, http.StatusUnprocessableEntity, "TOOL_ENTRY_VALIDATION_FAILED", "Tool entry request is invalid", validation.Fields)
	case errors.Is(err, toolentry.ErrStaleRevision):
		writeError(w, http.StatusConflict, "TOOL_ENTRY_STALE", "A newer version of this entry is already saved", nil)
	case errors.Is(err, toolentry.ErrTooManyEntries):
		writeError(w, http.StatusConflict, "TOOL_ENTRY_LIMIT_REACHED", "This tool has reached its entry limit", nil)
	case errors.Is(err, toolentry.ErrStorageUnavailable):
		writeError(w, http.StatusServiceUnavailable, "PERSONAL_STORAGE_UNAVAILABLE", "Account storage for tools is not available", nil)
	default:
		// Never log entry content: only the request id and the error.
		h.logger.Error("tool entries operation", "request_id", requestID(r.Context()), "error", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
	}
}
