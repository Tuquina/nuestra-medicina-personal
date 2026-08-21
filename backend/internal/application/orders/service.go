package orders

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/coupon"
	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

const mercadoPagoProvider = "MERCADO_PAGO"

type BookCatalog interface {
	GetPublishedBySlug(context.Context, string) (book.Book, error)
}

// Coupons is the read-only slice of the coupon repository checkout needs —
// looking a code up by its human-entered value. Usage-count reservation
// happens atomically inside Repository.Create instead, alongside the order
// insert, so it can't race with a concurrent checkout.
type Coupons interface {
	GetByCode(context.Context, string) (coupon.Coupon, error)
}

type Repository interface {
	Create(context.Context, order.Order) (order.Order, error)
	AttachPreference(context.Context, string, string, string, time.Time) (order.Order, error)
	// Expire marks a pending order as expired and, when couponID is set,
	// releases the usage reservation Create made for it in the same
	// transaction — a transient payment-provider failure must never
	// permanently burn a limited coupon's use.
	Expire(ctx context.Context, orderID, couponID string, now time.Time) error
	GetForUser(context.Context, string, string) (order.Order, error)
	ApplyPayment(context.Context, string, order.ProviderPayment, time.Time) (order.Order, error)
}

type CheckoutProvider interface {
	Configured() bool
	CreatePreference(context.Context, order.PreferenceRequest) (order.Preference, error)
	GetPayment(context.Context, string) (order.ProviderPayment, error)
}

type Service struct {
	books      BookCatalog
	coupons    Coupons
	repository Repository
	provider   CheckoutProvider
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(books BookCatalog, coupons Coupons, repository Repository, provider CheckoutProvider) *Service {
	return &Service{books: books, coupons: coupons, repository: repository, provider: provider, now: time.Now, newID: randomUUID}
}

func (s *Service) Create(ctx context.Context, userID, userEmail, bookSlug, couponCode string) (order.Order, error) {
	if !s.provider.Configured() {
		return order.Order{}, order.ErrPaymentNotReady
	}
	selectedBook, err := s.books.GetPublishedBySlug(ctx, bookSlug)
	if errors.Is(err, book.ErrNotFound) {
		return order.Order{}, order.ErrBookUnavailable
	}
	if err != nil {
		return order.Order{}, fmt.Errorf("get purchasable book: %w", err)
	}
	if selectedBook.PriceMinorUnits <= 0 {
		return order.Order{}, order.ErrBookUnavailable
	}
	now := s.now().UTC()
	var appliedCoupon coupon.Coupon
	var discountMinorUnits int64
	if couponCode != "" {
		appliedCoupon, discountMinorUnits, err = s.resolveCoupon(ctx, couponCode, selectedBook.ID, selectedBook.PriceMinorUnits, selectedBook.Currency, now)
		if err != nil {
			return order.Order{}, err
		}
	}
	orderID, err := s.newID()
	if err != nil {
		return order.Order{}, fmt.Errorf("generate order id: %w", err)
	}
	itemID, err := s.newID()
	if err != nil {
		return order.Order{}, fmt.Errorf("generate order item id: %w", err)
	}
	candidate := order.Order{
		ID: orderID, UserID: userID, Status: order.StatusPending,
		TotalMinorUnits: selectedBook.PriceMinorUnits - discountMinorUnits, Currency: selectedBook.Currency,
		CouponID: appliedCoupon.ID, CouponCode: appliedCoupon.Code, DiscountMinorUnits: discountMinorUnits,
		CreatedAt: now, UpdatedAt: now,
		Items: []order.Item{{
			ID: itemID, BookID: selectedBook.ID, BookSlug: selectedBook.Slug,
			BookTitle: selectedBook.Title, UnitPriceMinorUnits: selectedBook.PriceMinorUnits,
			Quantity: 1, Currency: selectedBook.Currency,
		}},
	}
	created, err := s.repository.Create(ctx, candidate)
	if err != nil {
		return order.Order{}, fmt.Errorf("create pending order: %w", err)
	}
	preference, err := s.provider.CreatePreference(ctx, order.PreferenceRequest{
		OrderID: created.ID, BookID: selectedBook.ID, BookSlug: selectedBook.Slug,
		Title: selectedBook.Title, Description: selectedBook.ShortDescription,
		AmountMinorUnits: created.TotalMinorUnits, Currency: created.Currency, PayerEmail: userEmail,
	})
	if err != nil {
		expireErr := s.repository.Expire(ctx, created.ID, created.CouponID, s.now().UTC())
		return order.Order{}, fmt.Errorf("create mercado pago preference: %w", errors.Join(order.ErrPaymentProvider, err, expireErr))
	}
	updated, err := s.repository.AttachPreference(ctx, created.ID, preference.ID, preference.CheckoutURL, s.now().UTC())
	if err != nil {
		expireErr := s.repository.Expire(ctx, created.ID, created.CouponID, s.now().UTC())
		return order.Order{}, fmt.Errorf("attach payment preference: %w", errors.Join(err, expireErr))
	}
	return updated, nil
}

func (s *Service) Get(ctx context.Context, userID, identifier string) (order.Order, error) {
	return s.repository.GetForUser(ctx, userID, identifier)
}

func (s *Service) ProcessPayment(ctx context.Context, providerPaymentID string) (order.Order, error) {
	if !s.provider.Configured() {
		return order.Order{}, order.ErrPaymentNotReady
	}
	payment, err := s.provider.GetPayment(ctx, providerPaymentID)
	if err != nil {
		return order.Order{}, fmt.Errorf("verify mercado pago payment: %w", errors.Join(order.ErrPaymentProvider, err))
	}
	if payment.ExternalReference == "" || payment.ProviderPaymentID == "" {
		return order.Order{}, order.ErrPaymentMismatch
	}
	return s.repository.ApplyPayment(ctx, mercadoPagoProvider, payment, s.now().UTC())
}

// resolveCoupon validates a customer-entered code against the coupon's
// effective status (active/dates/usage — coupon.Coupon.EffectiveStatus,
// shared with the admin screen) and book scope, then computes the discount.
// It never reserves usage itself; that happens atomically inside
// Repository.Create alongside the order insert.
func (s *Service) resolveCoupon(ctx context.Context, code, bookID string, priceMinorUnits int64, currency string, now time.Time) (coupon.Coupon, int64, error) {
	found, err := s.coupons.GetByCode(ctx, strings.ToUpper(strings.TrimSpace(code)))
	if errors.Is(err, coupon.ErrNotFound) {
		return coupon.Coupon{}, 0, order.ErrCouponInvalid
	}
	if err != nil {
		return coupon.Coupon{}, 0, fmt.Errorf("look up coupon: %w", err)
	}
	if found.EffectiveStatus(now) != "ACTIVE" {
		return coupon.Coupon{}, 0, order.ErrCouponInvalid
	}
	if !found.AppliesToAll && !slices.Contains(found.BookIDs, bookID) {
		return coupon.Coupon{}, 0, order.ErrCouponInvalid
	}
	// A fixed-amount coupon's Value is minor units of found.Currency — never
	// apply it against a book priced in a different currency (a percentage
	// coupon has no such issue, it scales with priceMinorUnits directly).
	if found.Kind == coupon.KindFixed && !strings.EqualFold(found.Currency, currency) {
		return coupon.Coupon{}, 0, order.ErrCouponInvalid
	}
	var discount int64
	switch found.Kind {
	case coupon.KindPercentage:
		discount = priceMinorUnits * found.Value / 100
	case coupon.KindFixed:
		discount = found.Value
	}
	if discount > priceMinorUnits {
		discount = priceMinorUnits
	}
	return found, discount, nil
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
