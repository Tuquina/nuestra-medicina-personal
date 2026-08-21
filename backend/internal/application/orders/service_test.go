package orders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/coupon"
	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type bookCatalogStub struct {
	value book.Book
	err   error
}

func (s bookCatalogStub) GetPublishedBySlug(context.Context, string) (book.Book, error) {
	return s.value, s.err
}

type couponsStub struct {
	value coupon.Coupon
	err   error
}

func (s couponsStub) GetByCode(context.Context, string) (coupon.Coupon, error) {
	return s.value, s.err
}

func activeCouponWindow() (time.Time, time.Time) {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
}

type repositoryStub struct {
	created         order.Order
	applied         order.ProviderPayment
	expired         string
	expiredCouponID string
}

func (r *repositoryStub) Expire(_ context.Context, id, couponID string, _ time.Time) error {
	r.expired = id
	r.expiredCouponID = couponID
	return nil
}

func (r *repositoryStub) Create(_ context.Context, value order.Order) (order.Order, error) {
	r.created = value
	return value, nil
}
func (r *repositoryStub) AttachPreference(_ context.Context, id, preferenceID, checkoutURL string, now time.Time) (order.Order, error) {
	r.created.ProviderPreferenceID = preferenceID
	r.created.CheckoutURL = checkoutURL
	r.created.UpdatedAt = now
	return r.created, nil
}
func (*repositoryStub) GetForUser(context.Context, string, string) (order.Order, error) {
	return order.Order{}, order.ErrNotFound
}
func (r *repositoryStub) ApplyPayment(_ context.Context, _ string, payment order.ProviderPayment, _ time.Time) (order.Order, error) {
	r.applied = payment
	return order.Order{ID: payment.ExternalReference, Status: order.StatusPaid}, nil
}

type providerStub struct {
	configured bool
	request    order.PreferenceRequest
	payment    order.ProviderPayment
	createErr  error
}

func (p *providerStub) Configured() bool { return p.configured }
func (p *providerStub) CreatePreference(_ context.Context, request order.PreferenceRequest) (order.Preference, error) {
	p.request = request
	if p.createErr != nil {
		return order.Preference{}, p.createErr
	}
	return order.Preference{ID: "pref-1", CheckoutURL: "https://mercadopago.example/checkout"}, nil
}
func (p *providerStub) GetPayment(context.Context, string) (order.ProviderPayment, error) {
	return p.payment, nil
}

func TestCreateSnapshotsPublishedBookPriceBeforePreference(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	provider := &providerStub{configured: true}
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", Title: "Un libro", ShortDescription: "Descripción",
		PriceMinorUnits: 1_890_000, Currency: "ARS", Status: book.StatusPublished,
	}}, couponsStub{}, repository, provider)
	now := time.Date(2026, 8, 19, 15, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	ids := []string{"order-id", "item-id"}
	service.newID = func() (string, error) {
		id := ids[0]
		ids = ids[1:]
		return id, nil
	}

	created, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if repository.created.TotalMinorUnits != 1_890_000 || repository.created.Items[0].UnitPriceMinorUnits != 1_890_000 {
		t.Fatalf("historical price was not copied: %#v", repository.created)
	}
	if provider.request.OrderID != "order-id" || provider.request.AmountMinorUnits != 1_890_000 || provider.request.PayerEmail != "buyer@example.com" {
		t.Fatalf("unexpected preference request: %#v", provider.request)
	}
	if created.CheckoutURL == "" || created.ProviderPreferenceID != "pref-1" {
		t.Fatalf("preference was not attached: %#v", created)
	}
}

func TestCreateFailsClosedWhenPaymentsAreNotConfigured(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(bookCatalogStub{}, couponsStub{}, repository, &providerStub{})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "")
	if !errors.Is(err, order.ErrPaymentNotReady) || repository.created.ID != "" {
		t.Fatalf("expected closed provider without order, got %v %#v", err, repository.created)
	}
}

func TestCreateRejectsDraftOrMissingBook(t *testing.T) {
	t.Parallel()
	service := NewService(bookCatalogStub{err: book.ErrNotFound}, couponsStub{}, &repositoryStub{}, &providerStub{configured: true})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "draft", "")
	if !errors.Is(err, order.ErrBookUnavailable) {
		t.Fatalf("expected unavailable book, got %v", err)
	}
}

func TestCreateExpiresPendingOrderWhenPreferenceFails(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", Title: "Un libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{}, repository, &providerStub{configured: true, createErr: errors.New("provider unavailable")})
	ids := []string{"order-id", "item-id"}
	service.newID = func() (string, error) {
		id := ids[0]
		ids = ids[1:]
		return id, nil
	}
	if _, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", ""); !errors.Is(err, order.ErrPaymentProvider) {
		t.Fatalf("expected typed preference failure, got %v", err)
	}
	if repository.expired != "order-id" {
		t.Fatalf("pending order was not expired: %q", repository.expired)
	}
}

func TestProcessPaymentUsesProviderAsIndependentSource(t *testing.T) {
	t.Parallel()
	payment := order.ProviderPayment{
		ProviderPaymentID: "payment-1", ExternalReference: "order-1",
		Status: order.PaymentApproved, AmountMinorUnits: 10000, Currency: "ARS",
	}
	repository := &repositoryStub{}
	service := NewService(bookCatalogStub{}, couponsStub{}, repository, &providerStub{configured: true, payment: payment})
	processed, err := service.ProcessPayment(context.Background(), "payment-1")
	if err != nil {
		t.Fatalf("process: %v", err)
	}
	if repository.applied.ProviderPaymentID != "payment-1" || processed.Status != order.StatusPaid {
		t.Fatalf("verified payment was not applied: %#v", repository.applied)
	}
}

func TestCreateAppliesValidCouponDiscount(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	starts, ends := activeCouponWindow()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", Title: "Un libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "PROMO10", Kind: coupon.KindPercentage, Value: 10,
		Active: true, AppliesToAll: true, StartsAt: starts, EndsAt: ends,
	}}, repository, &providerStub{configured: true})
	now := time.Date(2026, 8, 19, 15, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	ids := []string{"order-id", "item-id"}
	service.newID = func() (string, error) {
		id := ids[0]
		ids = ids[1:]
		return id, nil
	}
	if _, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "promo10"); err != nil {
		t.Fatalf("create: %v", err)
	}
	if repository.created.DiscountMinorUnits != 1000 || repository.created.TotalMinorUnits != 9000 {
		t.Fatalf("discount was not applied: %#v", repository.created)
	}
	if repository.created.CouponCode != "PROMO10" || repository.created.CouponID != "coupon-id" {
		t.Fatalf("coupon snapshot was not recorded: %#v", repository.created)
	}
}

func TestCreateRejectsCouponOutsideBookScope(t *testing.T) {
	t.Parallel()
	starts, ends := activeCouponWindow()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "OTROLIBRO", Kind: coupon.KindFixed, Value: 500,
		Active: true, AppliesToAll: false, BookIDs: []string{"other-book-id"}, StartsAt: starts, EndsAt: ends,
	}}, &repositoryStub{}, &providerStub{configured: true})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "OTROLIBRO")
	if !errors.Is(err, order.ErrCouponInvalid) {
		t.Fatalf("expected coupon invalid, got %v", err)
	}
}

func TestCreateRejectsExpiredCoupon(t *testing.T) {
	t.Parallel()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "VENCIDO", Kind: coupon.KindFixed, Value: 500, Active: true, AppliesToAll: true,
		StartsAt: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), EndsAt: time.Date(2020, 2, 1, 0, 0, 0, 0, time.UTC),
	}}, &repositoryStub{}, &providerStub{configured: true})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "VENCIDO")
	if !errors.Is(err, order.ErrCouponInvalid) {
		t.Fatalf("expected coupon invalid, got %v", err)
	}
}

func TestCreateRejectsUnknownCouponCode(t *testing.T) {
	t.Parallel()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{err: coupon.ErrNotFound}, &repositoryStub{}, &providerStub{configured: true})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "NOEXISTE")
	if !errors.Is(err, order.ErrCouponInvalid) {
		t.Fatalf("expected coupon invalid, got %v", err)
	}
}

func TestCreateRejectsFixedCouponInADifferentCurrency(t *testing.T) {
	t.Parallel()
	starts, ends := activeCouponWindow()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "USD",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "FIJOARS", Kind: coupon.KindFixed, Value: 1000, Currency: "ARS",
		Active: true, AppliesToAll: true, StartsAt: starts, EndsAt: ends,
	}}, &repositoryStub{}, &providerStub{configured: true})
	_, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "FIJOARS")
	if !errors.Is(err, order.ErrCouponInvalid) {
		t.Fatalf("expected coupon invalid for a currency mismatch, got %v", err)
	}
}

func TestCreateAllowsPercentageCouponRegardlessOfCurrency(t *testing.T) {
	t.Parallel()
	starts, ends := activeCouponWindow()
	repository := &repositoryStub{}
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "USD",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "PORC10", Kind: coupon.KindPercentage, Value: 10, Currency: "ARS",
		Active: true, AppliesToAll: true, StartsAt: starts, EndsAt: ends,
	}}, repository, &providerStub{configured: true})
	if _, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "PORC10"); err != nil {
		t.Fatalf("expected a percentage coupon to apply across currencies, got %v", err)
	}
	if repository.created.DiscountMinorUnits != 1000 {
		t.Fatalf("expected a 10%% discount, got %#v", repository.created)
	}
}

func TestCreateReleasesCouponReservationWhenPreferenceCreationFails(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	starts, ends := activeCouponWindow()
	service := NewService(bookCatalogStub{value: book.Book{
		ID: "book-id", Slug: "un-libro", PriceMinorUnits: 10000, Currency: "ARS",
	}}, couponsStub{value: coupon.Coupon{
		ID: "coupon-id", Code: "PROMO10", Kind: coupon.KindPercentage, Value: 10,
		Active: true, AppliesToAll: true, StartsAt: starts, EndsAt: ends,
	}}, repository, &providerStub{configured: true, createErr: errors.New("provider unavailable")})
	ids := []string{"order-id", "item-id"}
	service.newID = func() (string, error) {
		id := ids[0]
		ids = ids[1:]
		return id, nil
	}
	if _, err := service.Create(context.Background(), "user-id", "buyer@example.com", "un-libro", "promo10"); !errors.Is(err, order.ErrPaymentProvider) {
		t.Fatalf("expected typed preference failure, got %v", err)
	}
	if repository.expired != "order-id" || repository.expiredCouponID != "coupon-id" {
		t.Fatalf("expected the coupon reservation to be released on expire, got expired=%q couponID=%q", repository.expired, repository.expiredCouponID)
	}
}
