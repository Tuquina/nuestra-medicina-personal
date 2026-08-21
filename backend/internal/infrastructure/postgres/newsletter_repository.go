package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/newsletter"
)

const newsletterColumns = `id::text, user_id::text, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at`

type NewsletterRepository struct{ pool *pgxpool.Pool }

func NewNewsletterRepository(pool *pgxpool.Pool) *NewsletterRepository { return &NewsletterRepository{pool: pool} }

func (r *NewsletterRepository) Upsert(ctx context.Context, value newsletter.Subscription) (newsletter.Subscription, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO marketing_subscriptions (id, user_id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $8)
		ON CONFLICT (email) DO UPDATE SET
			user_id = COALESCE(EXCLUDED.user_id, marketing_subscriptions.user_id),
			status = EXCLUDED.status,
			source = EXCLUDED.source,
			subscribed_at = CASE WHEN EXCLUDED.status = 'SUBSCRIBED' THEN EXCLUDED.subscribed_at ELSE marketing_subscriptions.subscribed_at END,
			unsubscribed_at = EXCLUDED.unsubscribed_at,
			updated_at = EXCLUDED.updated_at
		RETURNING `+newsletterColumns,
		value.ID, value.UserID, value.Email, value.Status, value.Source, value.SubscribedAt, value.UnsubscribedAt, value.CreatedAt,
	)
	return scanNewsletterSubscription(row)
}

func (r *NewsletterRepository) GetByUserID(ctx context.Context, userID string) (newsletter.Subscription, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+newsletterColumns+` FROM marketing_subscriptions WHERE user_id = $1::uuid`, userID)
	return scanNewsletterSubscription(row)
}

func scanNewsletterSubscription(row rowScanner) (newsletter.Subscription, error) {
	var value newsletter.Subscription
	err := row.Scan(&value.ID, &value.UserID, &value.Email, &value.Status, &value.Source,
		&value.SubscribedAt, &value.UnsubscribedAt, &value.CreatedAt, &value.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return newsletter.Subscription{}, newsletter.ErrNotFound
	}
	if err != nil {
		return newsletter.Subscription{}, fmt.Errorf("scan newsletter subscription: %w", err)
	}
	return value, nil
}
