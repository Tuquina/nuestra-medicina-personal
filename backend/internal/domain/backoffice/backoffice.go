package backoffice

import "time"

type Range string

const (
	Range7Days  Range = "7d"
	Range30Days Range = "30d"
	RangeYear   Range = "year"
	RangeAll    Range = "all"
)

type Period struct {
	Range Range
	From  *time.Time
	To    time.Time
}

type Dashboard struct {
	Range                  Range
	Currency               string
	ApprovedSalesCount     int
	RevenueMinorUnits      int64
	BuyersCount            int
	AverageOrderMinorUnits int64
	PublishedBooksCount    int
	DraftBooksCount        int
	Trend                  []TrendPoint
	TopBooks               []BookMetric
	PaymentStatuses        []StatusMetric
	RecentSales            []Sale
	GeneratedAt            time.Time
}

type TrendPoint struct {
	PeriodStart       time.Time
	SalesCount        int
	RevenueMinorUnits int64
}

type BookMetric struct {
	BookID            string
	BookSlug          string
	BookTitle         string
	SalesCount        int
	RevenueMinorUnits int64
}

type StatusMetric struct {
	Status string
	Count  int
}

type Sale struct {
	ID                string
	CreatedAt         time.Time
	PaidAt            *time.Time
	CustomerID        string
	CustomerName      string
	CustomerEmail     string
	BookID            string
	BookSlug          string
	BookTitle         string
	AmountMinorUnits  int64
	Currency          string
	OrderStatus       string
	PaymentStatus     *string
	PaymentProvider   *string
	ProviderPaymentID *string
	DisplayStatus     string
}

type SalesFilter struct {
	Period   Period
	BookSlug string
	Status   string
	Query    string
	Limit    int
	Offset   int
}

type SalesPage struct {
	Items  []Sale
	Total  int
	Limit  int
	Offset int
}

type PurchasedBook struct {
	ID          string
	Slug        string
	Title       string
	PurchasedAt time.Time
}

type Customer struct {
	ID                   string
	DisplayName          string
	Email                string
	PictureURL           *string
	CreatedAt            time.Time
	LastLoginAt          *time.Time
	PaidOrdersCount      int
	BooksPurchasedCount  int
	TotalSpentMinorUnits int64
	Currency             string
	LastPurchaseAt       *time.Time
	PurchasedBooks       []PurchasedBook
}

type CustomerFilter struct {
	Query  string
	Limit  int
	Offset int
}

type CustomerPage struct {
	Items  []Customer
	Total  int
	Limit  int
	Offset int
}

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "backoffice query is invalid" }
