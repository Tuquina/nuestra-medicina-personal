package backoffice

import (
	"context"
	"errors"
	"testing"
	"time"

	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

type repositoryStub struct {
	period backofficedomain.Period
	filter backofficedomain.SalesFilter
}

func (stub *repositoryStub) Dashboard(_ context.Context, period backofficedomain.Period, _, _ string, _ time.Time) (backofficedomain.Dashboard, error) {
	stub.period = period
	return backofficedomain.Dashboard{Range: period.Range}, nil
}
func (stub *repositoryStub) Sales(_ context.Context, filter backofficedomain.SalesFilter) (backofficedomain.SalesPage, error) {
	stub.filter = filter
	return backofficedomain.SalesPage{Limit: filter.Limit, Offset: filter.Offset}, nil
}
func (*repositoryStub) Customers(context.Context, backofficedomain.CustomerFilter, []string, string) (backofficedomain.CustomerPage, error) {
	return backofficedomain.CustomerPage{}, nil
}

func TestDashboardBuildsInclusiveSevenDayPeriod(t *testing.T) {
	repository := &repositoryStub{}
	service := NewService(repository, nil)
	service.now = func() time.Time { return time.Date(2026, 8, 19, 18, 0, 0, 0, time.UTC) }
	if _, err := service.Dashboard(context.Background(), "7d", "", "ARS"); err != nil {
		t.Fatal(err)
	}
	want := time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)
	if repository.period.From == nil || !repository.period.From.Equal(want) {
		t.Fatalf("expected period from %s, got %#v", want, repository.period.From)
	}
}

func TestSalesNormalizesFiltersAndPagination(t *testing.T) {
	repository := &repositoryStub{}
	service := NewService(repository, nil)
	if _, err := service.Sales(context.Background(), backofficedomain.SalesFilter{
		Period: backofficedomain.Period{Range: "all"}, Status: " approved ", Query: " María ",
	}); err != nil {
		t.Fatal(err)
	}
	if repository.filter.Status != "APPROVED" || repository.filter.Query != "María" || repository.filter.Limit != 50 {
		t.Fatalf("unexpected normalized filter: %#v", repository.filter)
	}
}

func TestBackofficeRejectsUnknownRangeAndStatus(t *testing.T) {
	service := NewService(&repositoryStub{}, nil)
	tests := []error{}
	_, err := service.Dashboard(context.Background(), "quarter", "", "ARS")
	tests = append(tests, err)
	_, err = service.Sales(context.Background(), backofficedomain.SalesFilter{Period: backofficedomain.Period{Range: "all"}, Status: "unknown"})
	tests = append(tests, err)
	for _, candidate := range tests {
		var validationError *backofficedomain.ValidationError
		if !errors.As(candidate, &validationError) {
			t.Fatalf("expected validation error, got %v", candidate)
		}
	}
}
