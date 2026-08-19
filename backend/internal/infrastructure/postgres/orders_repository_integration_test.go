//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

func TestOrderPaymentIsIdempotentAgainstPostgres(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const (
		userID  = "10000000-0000-4000-8000-000000000001"
		bookID  = "20000000-0000-4000-8000-000000000001"
		orderID = "30000000-0000-4000-8000-000000000001"
		itemID  = "40000000-0000-4000-8000-000000000001"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM email_jobs WHERE recipient = 'buyer@example.com'`)
		_, _ = pool.Exec(ctx, `DELETE FROM payments WHERE order_id = $1::uuid`, orderID)
		_, _ = pool.Exec(ctx, `DELETE FROM order_items WHERE order_id = $1::uuid`, orderID)
		_, _ = pool.Exec(ctx, `DELETE FROM orders WHERE id = $1::uuid`, orderID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `INSERT INTO users (id, google_subject, email) VALUES ($1::uuid, 'integration-user', 'buyer@example.com')`, userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES ($1::uuid, 'integration-book', 'Integration book', 1890000, 'ARS', 'PUBLISHED')`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}
	now := time.Date(2026, 8, 19, 16, 0, 0, 0, time.UTC)
	repository := NewOrderRepository(pool)
	created, err := repository.Create(ctx, order.Order{
		ID: orderID, UserID: userID, Status: order.StatusPending,
		TotalMinorUnits: 1_890_000, Currency: "ARS", CreatedAt: now, UpdatedAt: now,
		Items: []order.Item{{
			ID: itemID, BookID: bookID, BookSlug: "integration-book", BookTitle: "Integration book",
			UnitPriceMinorUnits: 1_890_000, Quantity: 1, Currency: "ARS",
		}},
	})
	if err != nil || created.Status != order.StatusPending {
		t.Fatalf("create order: %#v %v", created, err)
	}
	payment := order.ProviderPayment{
		ProviderPaymentID: "integration-payment", ExternalReference: orderID,
		Status: order.PaymentApproved, RawStatus: "approved", AmountMinorUnits: 1_890_000,
		Currency: "ARS", RawPayload: []byte(`{"id":"integration-payment"}`),
	}
	first, err := repository.ApplyPayment(ctx, "MERCADO_PAGO", payment, now.Add(time.Minute))
	if err != nil || first.Status != order.StatusPaid {
		t.Fatalf("first payment: %#v %v", first, err)
	}
	second, err := repository.ApplyPayment(ctx, "MERCADO_PAGO", payment, now.Add(2*time.Minute))
	if err != nil || second.Status != order.StatusPaid {
		t.Fatalf("repeated payment: %#v %v", second, err)
	}
	var paymentCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE order_id = $1::uuid`, orderID).Scan(&paymentCount); err != nil {
		t.Fatalf("count payments: %v", err)
	}
	if paymentCount != 1 {
		t.Fatalf("expected one payment row after retry, got %d", paymentCount)
	}
	var emailJobCount int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM email_jobs
		WHERE recipient = 'buyer@example.com' AND type = 'payment.approved'`).Scan(&emailJobCount); err != nil {
		t.Fatalf("count email jobs: %v", err)
	}
	if emailJobCount != 1 {
		t.Fatalf("expected one email job after webhook retry, got %d", emailJobCount)
	}

	mismatch := payment
	mismatch.ProviderPaymentID = "mismatched-payment"
	mismatch.AmountMinorUnits++
	if _, err := repository.ApplyPayment(ctx, "MERCADO_PAGO", mismatch, now); !errors.Is(err, order.ErrPaymentMismatch) {
		t.Fatalf("expected amount mismatch, got %v", err)
	}
}
