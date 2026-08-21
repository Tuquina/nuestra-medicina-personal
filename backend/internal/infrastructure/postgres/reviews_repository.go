package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/review"
)

const reviewColumns = `r.id::text, r.book_id::text, b.slug, b.title, r.user_id::text,
	u.display_name, r.rating, r.body, r.status, r.created_at, r.updated_at, r.moderated_at`

type ReviewRepository struct{ pool *pgxpool.Pool }

func NewReviewRepository(pool *pgxpool.Pool) *ReviewRepository { return &ReviewRepository{pool: pool} }

func (r *ReviewRepository) ListApproved(ctx context.Context, bookSlug string) ([]review.Review, error) {
	return r.list(ctx, `SELECT `+reviewColumns+` FROM reviews r JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id
		WHERE b.slug=$1 AND b.status='PUBLISHED' AND r.status='APPROVED' ORDER BY r.created_at DESC`, bookSlug)
}
func (r *ReviewRepository) ListAdmin(ctx context.Context) ([]review.Review, error) {
	return r.list(ctx, `SELECT `+reviewColumns+` FROM reviews r JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC`)
}
func (r *ReviewRepository) list(ctx context.Context, query string, args ...any) ([]review.Review, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}
	defer rows.Close()
	items := make([]review.Review, 0)
	for rows.Next() {
		item, err := scanReview(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (r *ReviewRepository) CreateForPurchasedBook(ctx context.Context, value review.Review) (review.Review, error) {
	result, err := scanReview(r.pool.QueryRow(ctx, `WITH purchased_book AS (
		SELECT b.id FROM books b WHERE b.slug=$2 AND EXISTS (
			SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=$3::uuid AND o.status='PAID' AND oi.book_id=b.id)
	), inserted AS (
		INSERT INTO reviews (id,book_id,user_id,rating,body,status,created_at,updated_at)
		SELECT $1::uuid,purchased_book.id,$3::uuid,$4,$5,$6,$7,$8 FROM purchased_book RETURNING *
	)
	SELECT `+reviewColumns+` FROM inserted r JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id`,
		value.ID, value.BookSlug, value.UserID, value.Rating, value.Body, value.Status, value.CreatedAt, value.UpdatedAt))
	if errors.Is(err, review.ErrNotFound) {
		return review.Review{}, review.ErrPurchaseRequired
	}
	return result, normalizeReviewError(err)
}
func (r *ReviewRepository) SetStatus(ctx context.Context, id string, status review.Status, now time.Time) (review.Review, error) {
	return scanReview(r.pool.QueryRow(ctx, `WITH updated AS (UPDATE reviews SET status=$2,moderated_at=$3,updated_at=$3 WHERE id=$1::uuid RETURNING *)
		SELECT `+reviewColumns+` FROM updated r JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id`, id, status, now))
}
func (r *ReviewRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM reviews WHERE id=$1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return review.ErrNotFound
	}
	return nil
}
func scanReview(row rowScanner) (review.Review, error) {
	var value review.Review
	err := row.Scan(&value.ID, &value.BookID, &value.BookSlug, &value.BookTitle, &value.UserID, &value.CustomerName, &value.Rating, &value.Body, &value.Status, &value.CreatedAt, &value.UpdatedAt, &value.ModeratedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return review.Review{}, review.ErrNotFound
	}
	if err != nil {
		return review.Review{}, fmt.Errorf("scan review: %w", err)
	}
	return value, nil
}
func normalizeReviewError(err error) error {
	if err == nil || errors.Is(err, review.ErrNotFound) {
		return err
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "reviews_book_id_user_id_key" {
		return review.ErrAlreadyExists
	}
	return err
}
