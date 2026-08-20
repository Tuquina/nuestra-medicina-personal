package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/coupon"
)

const couponColumns = `
c.id::text, c.code, c.kind, c.value, c.currency, c.starts_at, c.ends_at,
	c.usage_limit, c.usage_count, c.applies_to_all, c.active, c.created_at,
	c.updated_at, COALESCE(array_agg(cb.book_id::text ORDER BY cb.book_id)
	FILTER (WHERE cb.book_id IS NOT NULL), ARRAY[]::text[])`

type CouponRepository struct{ pool *pgxpool.Pool }

func NewCouponRepository(pool *pgxpool.Pool) *CouponRepository { return &CouponRepository{pool: pool} }

func (r *CouponRepository) List(ctx context.Context) ([]coupon.Coupon, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+couponColumns+` FROM coupons c
		LEFT JOIN coupon_books cb ON cb.coupon_id = c.id
		GROUP BY c.id ORDER BY c.created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list coupons: %w", err)
	}
	defer rows.Close()
	items := make([]coupon.Coupon, 0)
	for rows.Next() {
		item, err := scanCoupon(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *CouponRepository) Create(ctx context.Context, value coupon.Coupon) (coupon.Coupon, error) {
	return r.save(ctx, value, true)
}

func (r *CouponRepository) Update(ctx context.Context, value coupon.Coupon) (coupon.Coupon, error) {
	return r.save(ctx, value, false)
}

func (r *CouponRepository) save(ctx context.Context, value coupon.Coupon, create bool) (coupon.Coupon, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return coupon.Coupon{}, fmt.Errorf("begin coupon save: %w", err)
	}
	defer tx.Rollback(ctx)
	if create {
		_, err = tx.Exec(ctx, `INSERT INTO coupons
			(id, code, kind, value, currency, starts_at, ends_at, usage_limit, usage_count, applies_to_all, active, created_at, updated_at)
			VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, value.ID, value.Code, value.Kind, value.Value,
			value.Currency, value.StartsAt, value.EndsAt, value.UsageLimit, value.UsageCount, value.AppliesToAll, value.Active, value.CreatedAt, value.UpdatedAt)
	} else {
		var tag pgconn.CommandTag
		tag, err = tx.Exec(ctx, `UPDATE coupons SET code=$2, kind=$3, value=$4, currency=$5, starts_at=$6,
			ends_at=$7, usage_limit=$8, applies_to_all=$9, active=$10, updated_at=$11 WHERE id=$1::uuid`,
			value.ID, value.Code, value.Kind, value.Value, value.Currency, value.StartsAt, value.EndsAt,
			value.UsageLimit, value.AppliesToAll, value.Active, value.UpdatedAt)
		if err == nil && tag.RowsAffected() == 0 {
			err = coupon.ErrNotFound
		}
	}
	if err != nil {
		return coupon.Coupon{}, normalizeCouponError(err)
	}
	if _, err = tx.Exec(ctx, `DELETE FROM coupon_books WHERE coupon_id=$1::uuid`, value.ID); err != nil {
		return coupon.Coupon{}, fmt.Errorf("replace coupon books: %w", err)
	}
	for _, bookID := range value.BookIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO coupon_books (coupon_id, book_id) VALUES ($1::uuid,$2::uuid)`, value.ID, bookID); err != nil {
			return coupon.Coupon{}, fmt.Errorf("insert coupon book: %w", err)
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return coupon.Coupon{}, fmt.Errorf("commit coupon save: %w", err)
	}
	return r.get(ctx, value.ID)
}

func (r *CouponRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM coupons WHERE id=$1::uuid`, id)
	if err != nil {
		return normalizeCouponError(err)
	}
	if tag.RowsAffected() == 0 {
		return coupon.ErrNotFound
	}
	return nil
}

func (r *CouponRepository) get(ctx context.Context, id string) (coupon.Coupon, error) {
	return scanCoupon(r.pool.QueryRow(ctx, `SELECT `+couponColumns+` FROM coupons c
		LEFT JOIN coupon_books cb ON cb.coupon_id=c.id WHERE c.id=$1::uuid GROUP BY c.id`, id))
}

func scanCoupon(row rowScanner) (coupon.Coupon, error) {
	var value coupon.Coupon
	err := row.Scan(&value.ID, &value.Code, &value.Kind, &value.Value, &value.Currency, &value.StartsAt,
		&value.EndsAt, &value.UsageLimit, &value.UsageCount, &value.AppliesToAll, &value.Active,
		&value.CreatedAt, &value.UpdatedAt, &value.BookIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		return coupon.Coupon{}, coupon.ErrNotFound
	}
	if err != nil {
		return coupon.Coupon{}, fmt.Errorf("scan coupon: %w", err)
	}
	return value, nil
}

func normalizeCouponError(err error) error {
	if errors.Is(err, coupon.ErrNotFound) {
		return err
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "coupons_code_key" {
		return coupon.ErrCodeConflict
	}
	return err
}
