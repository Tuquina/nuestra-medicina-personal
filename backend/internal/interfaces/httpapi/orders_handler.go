package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type OrderService interface {
	Create(context.Context, string, string, string, string) (order.Order, error)
	Get(context.Context, string, string) (order.Order, error)
	ProcessPayment(context.Context, string) (order.Order, error)
}

type MercadoPagoWebhookValidator interface {
	Validate(string, string, string) error
}

type OrderHandler struct {
	service   OrderService
	validator MercadoPagoWebhookValidator
	logger    *slog.Logger
}

func NewOrderHandler(service OrderService, validator MercadoPagoWebhookValidator, logger *slog.Logger) *OrderHandler {
	return &OrderHandler{service: service, validator: validator, logger: logger}
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input struct {
		BookSlug   string `json:"bookSlug"`
		CouponCode string `json:"couponCode"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body is not valid JSON", nil)
		return
	}
	user := currentUser(r.Context())
	created, err := h.service.Create(r.Context(), user.ID, user.Email, input.BookSlug, input.CouponCode)
	if err != nil {
		h.handleError(w, r, "create order", err)
		return
	}
	h.logger.Info("order created",
		"request_id", requestID(r.Context()), "user_id", user.ID,
		"order_id", created.ID, "book_slug", input.BookSlug,
	)
	w.Header().Set("Location", "/api/v1/orders/"+created.ID)
	writeJSON(w, http.StatusCreated, mapOrder(created))
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	value, err := h.service.Get(r.Context(), userID(r.Context()), r.PathValue("id"))
	if err != nil {
		h.handleError(w, r, "get order", err)
		return
	}
	writeJSON(w, http.StatusOK, mapOrder(value))
}

func (h *OrderHandler) MercadoPagoWebhook(w http.ResponseWriter, r *http.Request) {
	if webhookType := r.URL.Query().Get("type"); webhookType != "" && webhookType != "payment" {
		writeJSON(w, http.StatusNoContent, nil)
		return
	}
	dataID := r.URL.Query().Get("data.id")
	if dataID == "" {
		dataID = r.URL.Query().Get("data_id")
	}
	if err := h.validator.Validate(r.Header.Get("X-Signature"), r.Header.Get("X-Request-ID"), dataID); err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid", nil)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	processed, err := h.service.ProcessPayment(ctx, dataID)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) || errors.Is(err, order.ErrPaymentMismatch) {
			h.logger.Warn("verified payment does not match a local order", "request_id", requestID(r.Context()), "payment_id", dataID, "error", err)
			writeJSON(w, http.StatusNoContent, nil)
			return
		}
		h.handleError(w, r, "process mercado pago webhook", err, "payment_id", dataID)
		return
	}
	h.logger.Info("mercado pago webhook processed",
		"request_id", requestID(r.Context()), "payment_id", dataID,
		"order_id", processed.ID, "order_status", processed.Status,
	)
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *OrderHandler) handleError(w http.ResponseWriter, r *http.Request, operation string, err error, attributes ...any) {
	logAttributes := []any{"request_id", requestID(r.Context()), "user_id", userID(r.Context())}
	logAttributes = append(logAttributes, attributes...)
	logAttributes = append(logAttributes, "error", err)
	switch {
	case errors.Is(err, order.ErrNotFound):
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found", nil)
	case errors.Is(err, order.ErrBookUnavailable):
		writeError(w, http.StatusUnprocessableEntity, "BOOK_UNAVAILABLE", "Book is not available for purchase", nil)
	case errors.Is(err, order.ErrPaymentNotReady):
		writeError(w, http.StatusServiceUnavailable, "PAYMENTS_NOT_CONFIGURED", "Payments are not configured", nil)
	case errors.Is(err, order.ErrCouponInvalid):
		writeError(w, http.StatusUnprocessableEntity, "COUPON_INVALID", "Coupon code is not valid for this order", nil)
	case errors.Is(err, order.ErrPaymentProvider):
		h.logger.Error(operation, logAttributes...)
		writeError(w, http.StatusBadGateway, "PAYMENT_PROVIDER_ERROR", "Payment provider could not be reached", nil)
	default:
		h.logger.Error(operation, logAttributes...)
		writeError(w, http.StatusInternalServerError, "PAYMENT_PROCESSING_ERROR", "Payment operation could not be completed", nil)
	}
}

type orderResponse struct {
	ID                 string              `json:"id"`
	Status             order.Status        `json:"status"`
	TotalMinorUnits    int64               `json:"totalMinorUnits"`
	Currency           string              `json:"currency"`
	CheckoutURL        string              `json:"checkoutUrl,omitempty"`
	CouponCode         string              `json:"couponCode,omitempty"`
	DiscountMinorUnits int64               `json:"discountMinorUnits"`
	Items              []orderItemResponse `json:"items"`
	CreatedAt          time.Time           `json:"createdAt"`
	UpdatedAt          time.Time           `json:"updatedAt"`
	PaidAt             *time.Time          `json:"paidAt"`
}

type orderItemResponse struct {
	BookID              string `json:"bookId"`
	BookSlug            string `json:"bookSlug"`
	BookTitle           string `json:"bookTitle"`
	UnitPriceMinorUnits int64  `json:"unitPriceMinorUnits"`
	Quantity            int    `json:"quantity"`
	Currency            string `json:"currency"`
}

func mapOrder(value order.Order) orderResponse {
	items := make([]orderItemResponse, 0, len(value.Items))
	for _, item := range value.Items {
		items = append(items, orderItemResponse{
			BookID: item.BookID, BookSlug: item.BookSlug, BookTitle: item.BookTitle,
			UnitPriceMinorUnits: item.UnitPriceMinorUnits, Quantity: item.Quantity, Currency: item.Currency,
		})
	}
	return orderResponse{
		ID: value.ID, Status: value.Status, TotalMinorUnits: value.TotalMinorUnits,
		Currency: value.Currency, CheckoutURL: value.CheckoutURL,
		CouponCode: value.CouponCode, DiscountMinorUnits: value.DiscountMinorUnits, Items: items,
		CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt, PaidAt: value.PaidAt,
	}
}
