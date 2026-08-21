package order

import (
	"errors"
	"time"
)

type Status string

const (
	StatusPending   Status = "PENDING"
	StatusPaid      Status = "PAID"
	StatusCancelled Status = "CANCELLED"
	StatusExpired   Status = "EXPIRED"
)

type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "PENDING"
	PaymentApproved  PaymentStatus = "APPROVED"
	PaymentRejected  PaymentStatus = "REJECTED"
	PaymentCancelled PaymentStatus = "CANCELLED"
	PaymentRefunded  PaymentStatus = "REFUNDED"
)

var (
	ErrNotFound        = errors.New("order not found")
	ErrBookUnavailable = errors.New("book is unavailable for purchase")
	ErrPaymentMismatch = errors.New("payment does not match order")
	ErrPaymentNotReady = errors.New("payment provider is not configured")
	ErrPaymentProvider = errors.New("payment provider request failed")
	ErrInvalidWebhook  = errors.New("webhook signature is invalid")
	ErrCouponInvalid   = errors.New("coupon code is not valid for this order")
)

type Order struct {
	ID                   string
	UserID               string
	Status               Status
	TotalMinorUnits      int64
	Currency             string
	ProviderPreferenceID string
	CheckoutURL          string
	// CouponID drives the atomic usage-count increment in the repository;
	// it is never returned to clients. CouponCode/DiscountMinorUnits are
	// the historical snapshot (ADR 0003) — they stay on the order even if
	// the coupon is later edited or deleted.
	CouponID           string
	CouponCode         string
	DiscountMinorUnits int64
	Items              []Item
	CreatedAt          time.Time
	UpdatedAt          time.Time
	PaidAt             *time.Time
}

type Item struct {
	ID                  string
	BookID              string
	BookSlug            string
	BookTitle           string
	UnitPriceMinorUnits int64
	Quantity            int
	Currency            string
}

type ProviderPayment struct {
	ProviderPaymentID string
	ExternalReference string
	Status            PaymentStatus
	RawStatus         string
	AmountMinorUnits  int64
	Currency          string
	RawPayload        []byte
}

type PreferenceRequest struct {
	OrderID          string
	BookID           string
	BookSlug         string
	Title            string
	Description      string
	AmountMinorUnits int64
	Currency         string
	PayerEmail       string
}

type Preference struct {
	ID          string
	CheckoutURL string
}
