package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) *OrderRepository { return &OrderRepository{pool: pool} }

func (r *OrderRepository) Create(ctx context.Context, value order.Order) (order.Order, error) {
	if len(value.Items) != 1 {
		return order.Order{}, errors.New("an order must contain exactly one book")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return order.Order{}, fmt.Errorf("begin order transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		INSERT INTO orders (id, user_id, status, total_minor_units, currency, created_at, updated_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $6)`,
		value.ID, value.UserID, value.Status, value.TotalMinorUnits, value.Currency, value.CreatedAt,
	); err != nil {
		return order.Order{}, fmt.Errorf("insert order: %w", err)
	}
	item := value.Items[0]
	if _, err := tx.Exec(ctx, `
		INSERT INTO order_items (id, order_id, book_id, book_title, unit_price_minor_units, quantity, currency)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
		item.ID, value.ID, item.BookID, item.BookTitle, item.UnitPriceMinorUnits, item.Quantity, item.Currency,
	); err != nil {
		return order.Order{}, fmt.Errorf("insert order item: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return order.Order{}, fmt.Errorf("commit order: %w", err)
	}
	return value, nil
}

func (r *OrderRepository) AttachPreference(ctx context.Context, orderID, preferenceID, checkoutURL string, now time.Time) (order.Order, error) {
	command, err := r.pool.Exec(ctx, `
		UPDATE orders
		SET provider_preference_id = $2, checkout_url = $3, updated_at = $4
		WHERE id = $1::uuid AND status = 'PENDING'`, orderID, preferenceID, checkoutURL, now)
	if err != nil {
		return order.Order{}, fmt.Errorf("update order preference: %w", err)
	}
	if command.RowsAffected() == 0 {
		return order.Order{}, order.ErrNotFound
	}
	return r.get(ctx, orderID, "")
}

func (r *OrderRepository) GetForUser(ctx context.Context, userID, identifier string) (order.Order, error) {
	return r.get(ctx, identifier, userID)
}

func (r *OrderRepository) Expire(ctx context.Context, orderID string, now time.Time) error {
	if _, err := r.pool.Exec(ctx, `
		UPDATE orders SET status = 'EXPIRED', updated_at = $2
		WHERE id = $1::uuid AND status = 'PENDING'`, orderID, now); err != nil {
		return fmt.Errorf("expire pending order: %w", err)
	}
	return nil
}

func (r *OrderRepository) ApplyPayment(ctx context.Context, provider string, payment order.ProviderPayment, now time.Time) (order.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return order.Order{}, fmt.Errorf("begin payment transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var totalMinorUnits int64
	var currency string
	err = tx.QueryRow(ctx, `
		SELECT total_minor_units, currency
		FROM orders
		WHERE id::text = $1
		FOR UPDATE`, payment.ExternalReference).Scan(&totalMinorUnits, &currency)
	if errors.Is(err, pgx.ErrNoRows) {
		return order.Order{}, order.ErrNotFound
	}
	if err != nil {
		return order.Order{}, fmt.Errorf("lock payment order: %w", err)
	}
	if payment.AmountMinorUnits != totalMinorUnits || !strings.EqualFold(payment.Currency, currency) {
		return order.Order{}, order.ErrPaymentMismatch
	}
	paymentID, err := databaseUUID()
	if err != nil {
		return order.Order{}, fmt.Errorf("generate payment id: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO payments (
			id, order_id, provider, provider_payment_id, status, amount_minor_units,
			currency, raw_status, provider_payload, created_at, updated_at
		) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)
		ON CONFLICT (provider, provider_payment_id) DO UPDATE SET
			status = EXCLUDED.status,
			amount_minor_units = EXCLUDED.amount_minor_units,
			currency = EXCLUDED.currency,
			raw_status = EXCLUDED.raw_status,
			provider_payload = EXCLUDED.provider_payload,
			updated_at = EXCLUDED.updated_at`,
		paymentID, payment.ExternalReference, provider, payment.ProviderPaymentID,
		payment.Status, payment.AmountMinorUnits, payment.Currency, payment.RawStatus,
		payment.RawPayload, now,
	); err != nil {
		return order.Order{}, fmt.Errorf("upsert verified payment: %w", err)
	}
	switch payment.Status {
	case order.PaymentApproved:
		if _, err := tx.Exec(ctx, `
			UPDATE orders
			SET status = 'PAID', paid_at = COALESCE(paid_at, $2), updated_at = $2
			WHERE id::text = $1`, payment.ExternalReference, now); err != nil {
			return order.Order{}, fmt.Errorf("mark order paid: %w", err)
		}
	case order.PaymentCancelled, order.PaymentRefunded:
		if _, err := tx.Exec(ctx, `
			UPDATE orders SET status = 'CANCELLED', updated_at = $2 WHERE id::text = $1`,
			payment.ExternalReference, now); err != nil {
			return order.Order{}, fmt.Errorf("mark order refunded: %w", err)
		}
	}
	if jobType := paymentEmailJobType(payment.Status); jobType != "" {
		emailJobID, err := databaseUUID()
		if err != nil {
			return order.Order{}, fmt.Errorf("generate email job id: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO email_jobs (id, type, recipient, payload, dedupe_key, next_attempt_at, created_at, updated_at)
			SELECT $1::uuid, $2, users.email,
			       jsonb_build_object(
			           'orderId', orders.id::text,
			           'bookTitle', order_items.book_title,
			           'amountMinorUnits', orders.total_minor_units,
			           'currency', orders.currency,
			           'ebookAvailable', books.ebook_file_path IS NOT NULL AND books.ebook_file_path <> ''
			       ),
			       $3, $4, $4, $4
			FROM orders
			JOIN users ON users.id = orders.user_id
			JOIN order_items ON order_items.order_id = orders.id
			JOIN books ON books.id = order_items.book_id
			WHERE orders.id::text = $5
			LIMIT 1
			ON CONFLICT (dedupe_key) DO NOTHING`,
			emailJobID, jobType,
			fmt.Sprintf("payment:%s:%s:%s", provider, payment.ProviderPaymentID, payment.Status),
			now, payment.ExternalReference,
		); err != nil {
			return order.Order{}, fmt.Errorf("enqueue payment email: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return order.Order{}, fmt.Errorf("commit verified payment: %w", err)
	}
	return r.get(ctx, payment.ExternalReference, "")
}

func paymentEmailJobType(status order.PaymentStatus) string {
	switch status {
	case order.PaymentApproved:
		return "payment.approved"
	case order.PaymentPending:
		return "payment.pending"
	case order.PaymentRejected, order.PaymentCancelled:
		return "payment.failed"
	case order.PaymentRefunded:
		return "purchase.refunded"
	default:
		return ""
	}
}

func (r *OrderRepository) get(ctx context.Context, identifier, userID string) (order.Order, error) {
	var value order.Order
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, user_id::text, status, total_minor_units, currency,
		       COALESCE(provider_preference_id, ''), COALESCE(checkout_url, ''),
		       created_at, updated_at, paid_at
		FROM orders
		WHERE id::text = $1 AND ($2 = '' OR user_id::text = $2)`, identifier, userID,
	).Scan(
		&value.ID, &value.UserID, &value.Status, &value.TotalMinorUnits, &value.Currency,
		&value.ProviderPreferenceID, &value.CheckoutURL, &value.CreatedAt, &value.UpdatedAt, &value.PaidAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return order.Order{}, order.ErrNotFound
	}
	if err != nil {
		return order.Order{}, fmt.Errorf("get order: %w", err)
	}
	rows, err := r.pool.Query(ctx, `
		SELECT order_items.id::text, order_items.book_id::text, books.slug,
		       order_items.book_title, order_items.unit_price_minor_units,
		       order_items.quantity, order_items.currency
		FROM order_items
		JOIN books ON books.id = order_items.book_id
		WHERE order_items.order_id = $1::uuid
		ORDER BY order_items.id`, value.ID)
	if err != nil {
		return order.Order{}, fmt.Errorf("get order items: %w", err)
	}
	defer rows.Close()
	value.Items = make([]order.Item, 0, 1)
	for rows.Next() {
		var item order.Item
		if err := rows.Scan(
			&item.ID, &item.BookID, &item.BookSlug, &item.BookTitle,
			&item.UnitPriceMinorUnits, &item.Quantity, &item.Currency,
		); err != nil {
			return order.Order{}, fmt.Errorf("scan order item: %w", err)
		}
		value.Items = append(value.Items, item)
	}
	if err := rows.Err(); err != nil {
		return order.Order{}, fmt.Errorf("iterate order items: %w", err)
	}
	return value, nil
}
