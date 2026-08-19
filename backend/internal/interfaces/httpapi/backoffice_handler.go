package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

type BackofficeService interface {
	Dashboard(context.Context, string, string, string) (backofficedomain.Dashboard, error)
	Sales(context.Context, backofficedomain.SalesFilter) (backofficedomain.SalesPage, error)
	Customers(context.Context, backofficedomain.CustomerFilter, string) (backofficedomain.CustomerPage, error)
}

type BackofficeHandler struct {
	service BackofficeService
	logger  *slog.Logger
}

func NewBackofficeHandler(service BackofficeService, logger *slog.Logger) *BackofficeHandler {
	return &BackofficeHandler{service: service, logger: logger}
}

func (h *BackofficeHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	dashboard, err := h.service.Dashboard(r.Context(), query.Get("range"), query.Get("bookSlug"), query.Get("currency"))
	if h.writeError(w, r, "load backoffice dashboard", err) {
		return
	}
	writeJSON(w, http.StatusOK, mapDashboard(dashboard))
}

func (h *BackofficeHandler) Sales(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	limit, offset, err := parsePagination(query.Get("limit"), query.Get("offset"))
	if err != nil {
		h.writeValidationError(w, err)
		return
	}
	page, err := h.service.Sales(r.Context(), backofficedomain.SalesFilter{
		Period:   backofficedomain.Period{Range: backofficedomain.Range(query.Get("range"))},
		BookSlug: query.Get("bookSlug"), Status: query.Get("status"), Query: query.Get("query"),
		Limit: limit, Offset: offset,
	})
	if h.writeError(w, r, "list backoffice sales", err) {
		return
	}
	items := make([]saleResponse, 0, len(page.Items))
	for _, sale := range page.Items {
		items = append(items, mapSale(sale))
	}
	writeJSON(w, http.StatusOK, salesPageResponse{Items: items, Total: page.Total, Limit: page.Limit, Offset: page.Offset})
}

func (h *BackofficeHandler) Customers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	limit, offset, err := parsePagination(query.Get("limit"), query.Get("offset"))
	if err != nil {
		h.writeValidationError(w, err)
		return
	}
	page, err := h.service.Customers(r.Context(), backofficedomain.CustomerFilter{
		Query: query.Get("query"), Limit: limit, Offset: offset,
	}, query.Get("currency"))
	if h.writeError(w, r, "list backoffice customers", err) {
		return
	}
	items := make([]customerResponse, 0, len(page.Items))
	for _, customer := range page.Items {
		items = append(items, mapCustomer(customer))
	}
	writeJSON(w, http.StatusOK, customersPageResponse{Items: items, Total: page.Total, Limit: page.Limit, Offset: page.Offset})
}

func parsePagination(limitValue, offsetValue string) (int, int, error) {
	fields := make(map[string]string)
	limit := parseIntegerQuery(limitValue, "limit", fields)
	offset := parseIntegerQuery(offsetValue, "offset", fields)
	if len(fields) > 0 {
		return 0, 0, &backofficedomain.ValidationError{Fields: fields}
	}
	return limit, offset, nil
}

func parseIntegerQuery(value, field string, fields map[string]string) int {
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		fields[field] = "must be an integer"
		return 0
	}
	return parsed
}

func (h *BackofficeHandler) writeError(w http.ResponseWriter, r *http.Request, operation string, err error) bool {
	if err == nil {
		return false
	}
	var validationError *backofficedomain.ValidationError
	if errors.As(err, &validationError) {
		h.writeValidationError(w, validationError)
		return true
	}
	h.logger.Error(operation, "request_id", requestID(r.Context()), "user_id", userID(r.Context()), "error", err)
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
	return true
}

func (h *BackofficeHandler) writeValidationError(w http.ResponseWriter, err error) {
	var validationError *backofficedomain.ValidationError
	if errors.As(err, &validationError) {
		writeError(w, http.StatusUnprocessableEntity, "BACKOFFICE_QUERY_INVALID", "Backoffice query is invalid", validationError.Fields)
	}
}

type dashboardResponse struct {
	Range           backofficedomain.Range `json:"range"`
	Currency        string                 `json:"currency"`
	KPIs            dashboardKPIsResponse  `json:"kpis"`
	Books           dashboardBooksResponse `json:"books"`
	Trend           []trendPointResponse   `json:"trend"`
	TopBooks        []bookMetricResponse   `json:"topBooks"`
	PaymentStatuses []statusMetricResponse `json:"paymentStatuses"`
	RecentSales     []saleResponse         `json:"recentSales"`
	GeneratedAt     time.Time              `json:"generatedAt"`
}

type dashboardKPIsResponse struct {
	ApprovedSalesCount     int   `json:"approvedSalesCount"`
	RevenueMinorUnits      int64 `json:"revenueMinorUnits"`
	BuyersCount            int   `json:"buyersCount"`
	AverageOrderMinorUnits int64 `json:"averageOrderMinorUnits"`
}

type dashboardBooksResponse struct {
	PublishedCount int `json:"publishedCount"`
	DraftCount     int `json:"draftCount"`
}
type trendPointResponse struct {
	PeriodStart       time.Time `json:"periodStart"`
	SalesCount        int       `json:"salesCount"`
	RevenueMinorUnits int64     `json:"revenueMinorUnits"`
}
type bookMetricResponse struct {
	BookID            string `json:"bookId"`
	BookSlug          string `json:"bookSlug"`
	BookTitle         string `json:"bookTitle"`
	SalesCount        int    `json:"salesCount"`
	RevenueMinorUnits int64  `json:"revenueMinorUnits"`
}
type statusMetricResponse struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type saleResponse struct {
	ID                string     `json:"id"`
	CreatedAt         time.Time  `json:"createdAt"`
	PaidAt            *time.Time `json:"paidAt"`
	CustomerID        string     `json:"customerId"`
	CustomerName      string     `json:"customerName"`
	CustomerEmail     string     `json:"customerEmail"`
	BookID            string     `json:"bookId"`
	BookSlug          string     `json:"bookSlug"`
	BookTitle         string     `json:"bookTitle"`
	AmountMinorUnits  int64      `json:"amountMinorUnits"`
	Currency          string     `json:"currency"`
	OrderStatus       string     `json:"orderStatus"`
	PaymentStatus     *string    `json:"paymentStatus"`
	PaymentProvider   *string    `json:"paymentProvider"`
	ProviderPaymentID *string    `json:"providerPaymentId"`
	DisplayStatus     string     `json:"displayStatus"`
}

type salesPageResponse struct {
	Items  []saleResponse `json:"items"`
	Total  int            `json:"total"`
	Limit  int            `json:"limit"`
	Offset int            `json:"offset"`
}

type purchasedBookResponse struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	PurchasedAt time.Time `json:"purchasedAt"`
}
type customerResponse struct {
	ID                   string                  `json:"id"`
	DisplayName          string                  `json:"displayName"`
	Email                string                  `json:"email"`
	PictureURL           *string                 `json:"pictureUrl"`
	CreatedAt            time.Time               `json:"createdAt"`
	LastLoginAt          *time.Time              `json:"lastLoginAt"`
	PaidOrdersCount      int                     `json:"paidOrdersCount"`
	BooksPurchasedCount  int                     `json:"booksPurchasedCount"`
	TotalSpentMinorUnits int64                   `json:"totalSpentMinorUnits"`
	Currency             string                  `json:"currency"`
	LastPurchaseAt       *time.Time              `json:"lastPurchaseAt"`
	PurchasedBooks       []purchasedBookResponse `json:"purchasedBooks"`
}
type customersPageResponse struct {
	Items  []customerResponse `json:"items"`
	Total  int                `json:"total"`
	Limit  int                `json:"limit"`
	Offset int                `json:"offset"`
}

func mapDashboard(value backofficedomain.Dashboard) dashboardResponse {
	response := dashboardResponse{
		Range: value.Range, Currency: value.Currency,
		KPIs:  dashboardKPIsResponse{value.ApprovedSalesCount, value.RevenueMinorUnits, value.BuyersCount, value.AverageOrderMinorUnits},
		Books: dashboardBooksResponse{value.PublishedBooksCount, value.DraftBooksCount},
		Trend: make([]trendPointResponse, 0, len(value.Trend)), TopBooks: make([]bookMetricResponse, 0, len(value.TopBooks)),
		PaymentStatuses: make([]statusMetricResponse, 0, len(value.PaymentStatuses)), RecentSales: make([]saleResponse, 0, len(value.RecentSales)), GeneratedAt: value.GeneratedAt,
	}
	for _, point := range value.Trend {
		response.Trend = append(response.Trend, trendPointResponse{point.PeriodStart, point.SalesCount, point.RevenueMinorUnits})
	}
	for _, book := range value.TopBooks {
		response.TopBooks = append(response.TopBooks, bookMetricResponse{book.BookID, book.BookSlug, book.BookTitle, book.SalesCount, book.RevenueMinorUnits})
	}
	for _, status := range value.PaymentStatuses {
		response.PaymentStatuses = append(response.PaymentStatuses, statusMetricResponse{status.Status, status.Count})
	}
	for _, sale := range value.RecentSales {
		response.RecentSales = append(response.RecentSales, mapSale(sale))
	}
	return response
}

func mapSale(value backofficedomain.Sale) saleResponse {
	return saleResponse{value.ID, value.CreatedAt, value.PaidAt, value.CustomerID, value.CustomerName, value.CustomerEmail, value.BookID, value.BookSlug, value.BookTitle, value.AmountMinorUnits, value.Currency, value.OrderStatus, value.PaymentStatus, value.PaymentProvider, value.ProviderPaymentID, value.DisplayStatus}
}

func mapCustomer(value backofficedomain.Customer) customerResponse {
	books := make([]purchasedBookResponse, 0, len(value.PurchasedBooks))
	for _, book := range value.PurchasedBooks {
		books = append(books, purchasedBookResponse{book.ID, book.Slug, book.Title, book.PurchasedAt})
	}
	return customerResponse{value.ID, value.DisplayName, value.Email, value.PictureURL, value.CreatedAt, value.LastLoginAt, value.PaidOrdersCount, value.BooksPurchasedCount, value.TotalSpentMinorUnits, value.Currency, value.LastPurchaseAt, books}
}
