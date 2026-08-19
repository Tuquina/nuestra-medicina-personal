package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

type backofficeServiceStub struct {
	dashboard backofficedomain.Dashboard
	sales     backofficedomain.SalesPage
	customers backofficedomain.CustomerPage
	err       error
}

func (stub backofficeServiceStub) Dashboard(context.Context, string, string, string) (backofficedomain.Dashboard, error) {
	return stub.dashboard, stub.err
}
func (stub backofficeServiceStub) Sales(context.Context, backofficedomain.SalesFilter) (backofficedomain.SalesPage, error) {
	return stub.sales, stub.err
}
func (stub backofficeServiceStub) Customers(context.Context, backofficedomain.CustomerFilter, string) (backofficedomain.CustomerPage, error) {
	return stub.customers, stub.err
}

func TestBackofficeSalesPreservesHistoricalMoneyAndStatuses(t *testing.T) {
	t.Parallel()
	paymentStatus := "APPROVED"
	service := backofficeServiceStub{sales: backofficedomain.SalesPage{
		Items: []backofficedomain.Sale{{
			ID: "order-1", BookTitle: "Historical title", AmountMinorUnits: 12345, Currency: "ARS",
			OrderStatus: "PAID", PaymentStatus: &paymentStatus, DisplayStatus: "APPROVED",
		}},
		Total: 1, Limit: 50,
	}}
	handler := NewBackofficeHandler(service, slog.New(slog.NewTextHandler(io.Discard, nil)))
	recorder := httptest.NewRecorder()
	handler.Sales(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/sales", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Items []saleResponse `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	item := response.Items[0]
	if item.BookTitle != "Historical title" || item.AmountMinorUnits != 12345 || item.OrderStatus != "PAID" || item.PaymentStatus == nil || *item.PaymentStatus != "APPROVED" {
		t.Fatalf("contract lost historical or status data: %#v", item)
	}
}

func TestBackofficeRejectsMalformedPagination(t *testing.T) {
	t.Parallel()
	handler := NewBackofficeHandler(backofficeServiceStub{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	recorder := httptest.NewRecorder()
	handler.Sales(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/sales?limit=many", nil))
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestBackofficeDashboardRouteRequiresAdminSession(t *testing.T) {
	t.Parallel()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service := backofficeServiceStub{dashboard: backofficedomain.Dashboard{GeneratedAt: time.Now()}}
	router := NewRouter(Dependencies{
		Logger: logger, Books: bookServiceStub{}, Authentication: &authServiceStub{}, Database: healthStub{},
		AdminAuthorizer: authorizerStub{}, Backoffice: service, BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/dashboard", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
