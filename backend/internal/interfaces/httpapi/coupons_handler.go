package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/coupon"
)

type CouponService interface {
	List(context.Context) ([]coupon.Coupon, error)
	Create(context.Context, coupon.Coupon) (coupon.Coupon, error)
	Update(context.Context, string, coupon.Coupon) (coupon.Coupon, error)
	Delete(context.Context, string) error
}

type CouponHandler struct {
	service CouponService
	logger  *slog.Logger
	now     func() time.Time
}

func NewCouponHandler(service CouponService, logger *slog.Logger) *CouponHandler {
	return &CouponHandler{service: service, logger: logger, now: time.Now}
}

func (h *CouponHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		h.internalError(w, r, err)
		return
	}
	responses := make([]couponResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, h.mapResponse(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": responses, "total": len(responses)})
}

func (h *CouponHandler) Create(w http.ResponseWriter, r *http.Request) {
	value, ok := decodeCoupon(w, r)
	if !ok {
		return
	}
	created, err := h.service.Create(r.Context(), value)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	w.Header().Set("Location", "/api/v1/admin/coupons/"+created.ID)
	writeJSON(w, http.StatusCreated, h.mapResponse(created))
}

func (h *CouponHandler) Update(w http.ResponseWriter, r *http.Request) {
	value, ok := decodeCoupon(w, r)
	if !ok {
		return
	}
	updated, err := h.service.Update(r.Context(), r.PathValue("id"), value)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, h.mapResponse(updated))
}

func (h *CouponHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.Context(), r.PathValue("id")); err != nil {
		h.handleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type couponInput struct {
	Code         string      `json:"code"`
	Kind         coupon.Kind `json:"kind"`
	Value        int64       `json:"value"`
	Currency     string      `json:"currency"`
	StartsAt     string      `json:"startsAt"`
	EndsAt       string      `json:"endsAt"`
	UsageLimit   *int        `json:"usageLimit"`
	AppliesToAll bool        `json:"appliesToAll"`
	BookIDs      []string    `json:"bookIds"`
	Active       bool        `json:"active"`
}

func decodeCoupon(w http.ResponseWriter, r *http.Request) (coupon.Coupon, bool) {
	var input couponInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return coupon.Coupon{}, false
	}
	starts, err1 := time.Parse("2006-01-02", input.StartsAt)
	ends, err2 := time.Parse("2006-01-02", input.EndsAt)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusUnprocessableEntity, "COUPON_VALIDATION_FAILED", "Coupon data is invalid", map[string]string{"dates": "must use YYYY-MM-DD format"})
		return coupon.Coupon{}, false
	}
	return coupon.Coupon{Code: input.Code, Kind: input.Kind, Value: input.Value, Currency: input.Currency, StartsAt: starts,
		EndsAt: ends, UsageLimit: input.UsageLimit, AppliesToAll: input.AppliesToAll, BookIDs: input.BookIDs, Active: input.Active}, true
}

type couponResponse struct {
	ID           string      `json:"id"`
	Code         string      `json:"code"`
	Kind         coupon.Kind `json:"kind"`
	Value        int64       `json:"value"`
	Currency     string      `json:"currency"`
	StartsAt     string      `json:"startsAt"`
	EndsAt       string      `json:"endsAt"`
	UsageLimit   *int        `json:"usageLimit"`
	UsageCount   int         `json:"usageCount"`
	AppliesToAll bool        `json:"appliesToAll"`
	BookIDs      []string    `json:"bookIds"`
	Active       bool        `json:"active"`
	Status       string      `json:"status"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (h *CouponHandler) mapResponse(value coupon.Coupon) couponResponse {
	return couponResponse{ID: value.ID, Code: value.Code, Kind: value.Kind, Value: value.Value, Currency: value.Currency,
		StartsAt: value.StartsAt.Format("2006-01-02"), EndsAt: value.EndsAt.Format("2006-01-02"), UsageLimit: value.UsageLimit,
		UsageCount: value.UsageCount, AppliesToAll: value.AppliesToAll, BookIDs: value.BookIDs, Active: value.Active,
		Status: value.EffectiveStatus(h.now().UTC()), CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}

func (h *CouponHandler) handleError(w http.ResponseWriter, r *http.Request, err error) {
	var validation *coupon.ValidationError
	switch {
	case errors.Is(err, coupon.ErrNotFound):
		writeError(w, http.StatusNotFound, "COUPON_NOT_FOUND", "Coupon not found", nil)
	case errors.Is(err, coupon.ErrCodeConflict):
		writeError(w, http.StatusConflict, "COUPON_CODE_CONFLICT", "A coupon with this code already exists", map[string]string{"code": "already exists"})
	case errors.As(err, &validation):
		writeError(w, http.StatusUnprocessableEntity, "COUPON_VALIDATION_FAILED", "Coupon data is invalid", validation.Fields)
	default:
		h.internalError(w, r, err)
	}
}

func (h *CouponHandler) internalError(w http.ResponseWriter, r *http.Request, err error) {
	h.logger.Error("coupon operation", "request_id", requestID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
}
