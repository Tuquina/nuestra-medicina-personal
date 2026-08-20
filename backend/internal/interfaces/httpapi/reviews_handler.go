package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/review"
)

type ReviewService interface {
	ListApproved(context.Context, string) ([]review.Review, error)
	ListAdmin(context.Context) ([]review.Review, error)
	Create(context.Context, string, string, review.Review) (review.Review, error)
	SetStatus(context.Context, string, review.Status) (review.Review, error)
	Delete(context.Context, string) error
}
type ReviewHandler struct {
	service ReviewService
	logger  *slog.Logger
}

func NewReviewHandler(service ReviewService, logger *slog.Logger) *ReviewHandler {
	return &ReviewHandler{service: service, logger: logger}
}

func (h *ReviewHandler) ListApproved(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListApproved(r.Context(), r.PathValue("slug"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	h.listResponse(w, items)
}
func (h *ReviewHandler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListAdmin(r.Context())
	if err != nil {
		h.fail(w, r, err)
		return
	}
	h.listResponse(w, items)
}
func (h *ReviewHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input reviewInput
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	created, err := h.service.Create(r.Context(), userID(r.Context()), r.PathValue("slug"), review.Review{Rating: input.Rating, Body: input.Body})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, mapReview(created))
}
func (h *ReviewHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	var input reviewStatusInput
	if decodeJSON(r, &input) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	updated, err := h.service.SetStatus(r.Context(), r.PathValue("id"), input.Status)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mapReview(updated))
}
func (h *ReviewHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.Context(), r.PathValue("id")); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
func (h *ReviewHandler) listResponse(w http.ResponseWriter, items []review.Review) {
	mapped := make([]reviewResponse, 0, len(items))
	for _, item := range items {
		mapped = append(mapped, mapReview(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": mapped, "total": len(mapped)})
}

type reviewInput struct {
	Rating int    `json:"rating"`
	Body   string `json:"body"`
}
type reviewStatusInput struct {
	Status review.Status `json:"status"`
}
type reviewResponse struct {
	ID           string        `json:"id"`
	BookID       string        `json:"bookId"`
	BookSlug     string        `json:"bookSlug"`
	BookTitle    string        `json:"bookTitle"`
	CustomerName string        `json:"customerName"`
	Rating       int           `json:"rating"`
	Body         string        `json:"body"`
	Status       review.Status `json:"status"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
}

func mapReview(value review.Review) reviewResponse {
	return reviewResponse{ID: value.ID, BookID: value.BookID, BookSlug: value.BookSlug, BookTitle: value.BookTitle, CustomerName: value.CustomerName, Rating: value.Rating, Body: value.Body, Status: value.Status, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func (h *ReviewHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	var validation *review.ValidationError
	switch {
	case errors.Is(err, review.ErrNotFound):
		writeError(w, http.StatusNotFound, "REVIEW_NOT_FOUND", "Review not found", nil)
	case errors.Is(err, review.ErrAlreadyExists):
		writeError(w, http.StatusConflict, "REVIEW_ALREADY_EXISTS", "You already reviewed this book", nil)
	case errors.Is(err, review.ErrPurchaseRequired):
		writeError(w, http.StatusForbidden, "REVIEW_PURCHASE_REQUIRED", "A paid purchase is required to review this book", nil)
	case errors.As(err, &validation):
		writeError(w, http.StatusUnprocessableEntity, "REVIEW_VALIDATION_FAILED", "Review data is invalid", validation.Fields)
	default:
		h.logger.Error("review operation", "request_id", requestID(r.Context()), "error", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
	}
}
