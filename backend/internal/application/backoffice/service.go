package backoffice

import (
	"context"
	"strings"
	"time"

	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

type Repository interface {
	Dashboard(context.Context, backofficedomain.Period, string, string, time.Time) (backofficedomain.Dashboard, error)
	Sales(context.Context, backofficedomain.SalesFilter) (backofficedomain.SalesPage, error)
	Customers(context.Context, backofficedomain.CustomerFilter, []string, string) (backofficedomain.CustomerPage, error)
}

type Service struct {
	repository      Repository
	adminGoogleSubs []string
	now             func() time.Time
}

func NewService(repository Repository, adminGoogleSubs []string) *Service {
	return &Service{repository: repository, adminGoogleSubs: adminGoogleSubs, now: time.Now}
}

func (s *Service) Dashboard(ctx context.Context, rangeValue, bookSlug, currency string) (backofficedomain.Dashboard, error) {
	now := s.now().UTC()
	period, err := parsePeriod(rangeValue, now)
	if err != nil {
		return backofficedomain.Dashboard{}, err
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		currency = "ARS"
	}
	if len(currency) != 3 {
		return backofficedomain.Dashboard{}, &backofficedomain.ValidationError{Fields: map[string]string{"currency": "must contain 3 letters"}}
	}
	return s.repository.Dashboard(ctx, period, strings.TrimSpace(bookSlug), currency, now)
}

func (s *Service) Sales(ctx context.Context, filter backofficedomain.SalesFilter) (backofficedomain.SalesPage, error) {
	period, err := parsePeriod(string(filter.Period.Range), s.now().UTC())
	if err != nil {
		return backofficedomain.SalesPage{}, err
	}
	filter.Period = period
	filter.BookSlug = strings.TrimSpace(filter.BookSlug)
	filter.Query = strings.TrimSpace(filter.Query)
	filter.Status = strings.ToUpper(strings.TrimSpace(filter.Status))
	if filter.Status != "" && !validStatus(filter.Status) {
		return backofficedomain.SalesPage{}, &backofficedomain.ValidationError{Fields: map[string]string{"status": "is not supported"}}
	}
	filter.Limit, filter.Offset, err = normalizePagination(filter.Limit, filter.Offset)
	if err != nil {
		return backofficedomain.SalesPage{}, err
	}
	return s.repository.Sales(ctx, filter)
}

func (s *Service) Customers(ctx context.Context, filter backofficedomain.CustomerFilter, currency string) (backofficedomain.CustomerPage, error) {
	var err error
	filter.Query = strings.TrimSpace(filter.Query)
	filter.Limit, filter.Offset, err = normalizePagination(filter.Limit, filter.Offset)
	if err != nil {
		return backofficedomain.CustomerPage{}, err
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		currency = "ARS"
	}
	if len(currency) != 3 {
		return backofficedomain.CustomerPage{}, &backofficedomain.ValidationError{Fields: map[string]string{"currency": "must contain 3 letters"}}
	}
	return s.repository.Customers(ctx, filter, s.adminGoogleSubs, currency)
}

func parsePeriod(value string, now time.Time) (backofficedomain.Period, error) {
	rangeValue := backofficedomain.Range(strings.TrimSpace(value))
	if rangeValue == "" {
		rangeValue = backofficedomain.RangeYear
	}
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	period := backofficedomain.Period{Range: rangeValue, To: now}
	switch rangeValue {
	case backofficedomain.Range7Days:
		from := startOfDay.AddDate(0, 0, -6)
		period.From = &from
	case backofficedomain.Range30Days:
		from := startOfDay.AddDate(0, 0, -29)
		period.From = &from
	case backofficedomain.RangeYear:
		from := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
		period.From = &from
	case backofficedomain.RangeAll:
	case "":
	default:
		return backofficedomain.Period{}, &backofficedomain.ValidationError{Fields: map[string]string{"range": "must be 7d, 30d, year or all"}}
	}
	return period, nil
}

func normalizePagination(limit, offset int) (int, int, error) {
	fields := make(map[string]string)
	if limit == 0 {
		limit = 50
	}
	if limit < 1 || limit > 100 {
		fields["limit"] = "must be between 1 and 100"
	}
	if offset < 0 {
		fields["offset"] = "must be zero or greater"
	}
	if len(fields) > 0 {
		return 0, 0, &backofficedomain.ValidationError{Fields: fields}
	}
	return limit, offset, nil
}

func validStatus(value string) bool {
	switch value {
	case "APPROVED", "PENDING", "REJECTED", "REFUNDED", "CANCELLED", "EXPIRED":
		return true
	default:
		return false
	}
}
