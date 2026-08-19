package orders

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

const mercadoPagoProvider = "MERCADO_PAGO"

type BookCatalog interface {
	GetPublishedBySlug(context.Context, string) (book.Book, error)
}

type Repository interface {
	Create(context.Context, order.Order) (order.Order, error)
	AttachPreference(context.Context, string, string, string, time.Time) (order.Order, error)
	Expire(context.Context, string, time.Time) error
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
	repository Repository
	provider   CheckoutProvider
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(books BookCatalog, repository Repository, provider CheckoutProvider) *Service {
	return &Service{books: books, repository: repository, provider: provider, now: time.Now, newID: randomUUID}
}

func (s *Service) Create(ctx context.Context, userID, userEmail, bookSlug string) (order.Order, error) {
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
	orderID, err := s.newID()
	if err != nil {
		return order.Order{}, fmt.Errorf("generate order id: %w", err)
	}
	itemID, err := s.newID()
	if err != nil {
		return order.Order{}, fmt.Errorf("generate order item id: %w", err)
	}
	now := s.now().UTC()
	candidate := order.Order{
		ID: orderID, UserID: userID, Status: order.StatusPending,
		TotalMinorUnits: selectedBook.PriceMinorUnits, Currency: selectedBook.Currency,
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
		expireErr := s.repository.Expire(ctx, created.ID, s.now().UTC())
		return order.Order{}, fmt.Errorf("create mercado pago preference: %w", errors.Join(order.ErrPaymentProvider, err, expireErr))
	}
	updated, err := s.repository.AttachPreference(ctx, created.ID, preference.ID, preference.CheckoutURL, s.now().UTC())
	if err != nil {
		expireErr := s.repository.Expire(ctx, created.ID, s.now().UTC())
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

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
