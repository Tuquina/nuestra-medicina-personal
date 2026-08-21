//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"sync"
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

	cancelledAttempt := payment
	cancelledAttempt.ProviderPaymentID = "integration-cancelled-payment"
	cancelledAttempt.Status = order.PaymentCancelled
	cancelledAttempt.RawStatus = "cancelled"
	cancelledAttempt.RawPayload = []byte(`{"id":"integration-cancelled-payment"}`)
	stillPaid, err := repository.ApplyPayment(ctx, "MERCADO_PAGO", cancelledAttempt, now.Add(3*time.Minute))
	if err != nil || stillPaid.Status != order.StatusPaid {
		t.Fatalf("cancelled attempt after approved payment: %#v %v", stillPaid, err)
	}
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM email_jobs
		WHERE recipient = 'buyer@example.com' AND type = 'payment.failed'`).Scan(&emailJobCount); err != nil {
		t.Fatalf("count failed-payment email jobs: %v", err)
	}
	if emailJobCount != 0 {
		t.Fatalf("expected no failed-payment email for a paid order, got %d", emailJobCount)
	}

	mismatch := payment
	mismatch.ProviderPaymentID = "mismatched-payment"
	mismatch.AmountMinorUnits++
	if _, err := repository.ApplyPayment(ctx, "MERCADO_PAGO", mismatch, now); !errors.Is(err, order.ErrPaymentMismatch) {
		t.Fatalf("expected amount mismatch, got %v", err)
	}
}

// TestOrderCreationReservesLimitedCouponUsageAtomically guards the exact
// race the checkout coupon feature exists to prevent: two customers
// checking out at the same instant against a coupon with usage_limit=1
// must never both succeed.
func TestOrderCreationReservesLimitedCouponUsageAtomically(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 4, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const (
		userAID  = "10000000-0000-4000-8000-000000000010"
		userBID  = "10000000-0000-4000-8000-000000000011"
		bookID   = "20000000-0000-4000-8000-000000000010"
		couponID = "50000000-0000-4000-8000-000000000001"
		orderAID = "30000000-0000-4000-8000-000000000010"
		orderBID = "30000000-0000-4000-8000-000000000011"
	)
	cleanup := func() {
		for _, id := range []string{orderAID, orderBID} {
			_, _ = pool.Exec(ctx, `DELETE FROM order_items WHERE order_id = $1::uuid`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM orders WHERE id = $1::uuid`, id)
		}
		_, _ = pool.Exec(ctx, `DELETE FROM coupons WHERE id = $1::uuid`, couponID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{userAID, userBID})
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `INSERT INTO users (id, google_subject, email) VALUES
		($1::uuid, 'integration-coupon-user-a', 'buyer-a@example.com'),
		($2::uuid, 'integration-coupon-user-b', 'buyer-b@example.com')`, userAID, userBID); err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES ($1::uuid, 'integration-coupon-book', 'Integration coupon book', 10000, 'ARS', 'PUBLISHED')`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}
	now := time.Date(2026, 8, 19, 16, 0, 0, 0, time.UTC)
	if _, err := pool.Exec(ctx, `
		INSERT INTO coupons (id, code, kind, value, currency, starts_at, ends_at, usage_limit, usage_count, applies_to_all, active, created_at, updated_at)
		VALUES ($1::uuid, 'RACEONE', 'FIXED', 1000, 'ARS', $2::date - 1, $2::date + 1, 1, 0, TRUE, TRUE, $2, $2)`,
		couponID, now); err != nil {
		t.Fatalf("seed coupon: %v", err)
	}

	repository := NewOrderRepository(pool)
	attempt := func(orderID, userID string) error {
		_, err := repository.Create(ctx, order.Order{
			ID: orderID, UserID: userID, Status: order.StatusPending,
			TotalMinorUnits: 9000, Currency: "ARS", CouponID: couponID, CouponCode: "RACEONE", DiscountMinorUnits: 1000,
			CreatedAt: now, UpdatedAt: now,
			Items: []order.Item{{
				ID: orderID, BookID: bookID, BookSlug: "integration-coupon-book", BookTitle: "Integration coupon book",
				UnitPriceMinorUnits: 10000, Quantity: 1, Currency: "ARS",
			}},
		})
		return err
	}

	var wg sync.WaitGroup
	results := make([]error, 2)
	wg.Add(2)
	go func() { defer wg.Done(); results[0] = attempt(orderAID, userAID) }()
	go func() { defer wg.Done(); results[1] = attempt(orderBID, userBID) }()
	wg.Wait()

	successes := 0
	for _, result := range results {
		switch {
		case result == nil:
			successes++
		case errors.Is(result, order.ErrCouponInvalid):
			// expected for the loser of the race
		default:
			t.Fatalf("unexpected error reserving coupon usage: %v", result)
		}
	}
	if successes != 1 {
		t.Fatalf("expected exactly one order to reserve the coupon, got %d successes: %#v", successes, results)
	}
	var usageCount int
	if err := pool.QueryRow(ctx, `SELECT usage_count FROM coupons WHERE id = $1::uuid`, couponID).Scan(&usageCount); err != nil {
		t.Fatalf("read usage count: %v", err)
	}
	if usageCount != 1 {
		t.Fatalf("expected usage_count to end at 1, got %d", usageCount)
	}
}
