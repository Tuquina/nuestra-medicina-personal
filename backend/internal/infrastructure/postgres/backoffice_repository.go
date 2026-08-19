package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

type BackofficeRepository struct {
	pool *pgxpool.Pool
}

func NewBackofficeRepository(pool *pgxpool.Pool) *BackofficeRepository {
	return &BackofficeRepository{pool: pool}
}

func (r *BackofficeRepository) Dashboard(
	ctx context.Context,
	period backofficedomain.Period,
	bookSlug, currency string,
	now time.Time,
) (backofficedomain.Dashboard, error) {
	value := backofficedomain.Dashboard{
		Range: period.Range, Currency: currency, Trend: []backofficedomain.TrendPoint{},
		TopBooks: []backofficedomain.BookMetric{}, PaymentStatuses: []backofficedomain.StatusMetric{},
		RecentSales: []backofficedomain.Sale{}, GeneratedAt: now,
	}
	err := r.pool.QueryRow(ctx, `
		SELECT count(*)::int,
		       COALESCE(sum(orders.total_minor_units), 0)::bigint,
		       count(DISTINCT orders.user_id)::int
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		JOIN books ON books.id = order_items.book_id
		WHERE orders.status = 'PAID'
		  AND orders.currency = $1
		  AND ($2::timestamptz IS NULL OR orders.paid_at >= $2)
		  AND orders.paid_at <= $3
		  AND ($4 = '' OR books.slug = $4)`,
		currency, period.From, period.To, bookSlug,
	).Scan(&value.ApprovedSalesCount, &value.RevenueMinorUnits, &value.BuyersCount)
	if err != nil {
		return backofficedomain.Dashboard{}, fmt.Errorf("query dashboard metrics: %w", err)
	}
	if value.ApprovedSalesCount > 0 {
		value.AverageOrderMinorUnits = value.RevenueMinorUnits / int64(value.ApprovedSalesCount)
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE status = 'PUBLISHED')::int,
		       count(*) FILTER (WHERE status = 'DRAFT')::int
		FROM books`).Scan(&value.PublishedBooksCount, &value.DraftBooksCount); err != nil {
		return backofficedomain.Dashboard{}, fmt.Errorf("query dashboard book counts: %w", err)
	}
	trend, err := r.queryTrend(ctx, period, bookSlug, currency, now)
	if err != nil {
		return backofficedomain.Dashboard{}, err
	}
	value.Trend = trend
	value.TopBooks, err = r.queryTopBooks(ctx, period, bookSlug, currency)
	if err != nil {
		return backofficedomain.Dashboard{}, err
	}
	value.PaymentStatuses, err = r.queryStatusCounts(ctx, period, bookSlug)
	if err != nil {
		return backofficedomain.Dashboard{}, err
	}
	recent, err := r.Sales(ctx, backofficedomain.SalesFilter{
		Period: period, BookSlug: bookSlug, Limit: 5,
	})
	if err != nil {
		return backofficedomain.Dashboard{}, err
	}
	value.RecentSales = recent.Items
	return value, nil
}

func (r *BackofficeRepository) Sales(ctx context.Context, filter backofficedomain.SalesFilter) (backofficedomain.SalesPage, error) {
	total, err := r.countSales(ctx, filter)
	if err != nil {
		return backofficedomain.SalesPage{}, err
	}
	rows, err := r.pool.Query(ctx, `
		WITH sale_rows AS (
			SELECT orders.id::text, orders.created_at, orders.paid_at,
			       users.id::text AS customer_id,
			       COALESCE(NULLIF(users.display_name, ''), split_part(users.email, '@', 1)) AS customer_name,
			       users.email AS customer_email,
			       books.id::text AS book_id, books.slug AS book_slug,
			       order_items.book_title, orders.total_minor_units, orders.currency,
			       orders.status AS order_status, selected_payment.status AS payment_status,
			       selected_payment.provider AS payment_provider,
			       selected_payment.provider_payment_id,
			       CASE
			           WHEN orders.status = 'PAID' THEN 'APPROVED'
			           WHEN selected_payment.status = 'REFUNDED' THEN 'REFUNDED'
			           WHEN selected_payment.status = 'REJECTED' THEN 'REJECTED'
			           WHEN selected_payment.status = 'CANCELLED' THEN 'CANCELLED'
			           WHEN orders.status = 'EXPIRED' THEN 'EXPIRED'
			           ELSE 'PENDING'
			       END AS display_status
			FROM orders
			JOIN users ON users.id = orders.user_id
			JOIN order_items ON order_items.order_id = orders.id
			JOIN books ON books.id = order_items.book_id
			LEFT JOIN LATERAL (
				SELECT payments.status, payments.provider, payments.provider_payment_id
				FROM payments
				WHERE payments.order_id = orders.id
				ORDER BY
					CASE WHEN orders.status = 'PAID' AND payments.status = 'APPROVED' THEN 0 ELSE 1 END,
					payments.updated_at DESC
				LIMIT 1
			) selected_payment ON true
		)
		SELECT id, created_at, paid_at, customer_id, customer_name,
		       customer_email, book_id, book_slug, book_title, total_minor_units,
		       currency, order_status, payment_status, payment_provider,
		       provider_payment_id, display_status
		FROM sale_rows
		WHERE ($1::timestamptz IS NULL OR created_at >= $1)
		  AND created_at <= $2
		  AND ($3 = '' OR book_slug = $3)
		  AND ($4 = '' OR display_status = $4)
		  AND ($5 = '' OR customer_name ILIKE '%' || $5 || '%'
		       OR customer_email ILIKE '%' || $5 || '%'
		       OR book_title ILIKE '%' || $5 || '%'
		       OR id = $5)
		ORDER BY created_at DESC, id DESC
		LIMIT $6 OFFSET $7`,
		filter.Period.From, filter.Period.To, filter.BookSlug, filter.Status,
		filter.Query, filter.Limit, filter.Offset,
	)
	if err != nil {
		return backofficedomain.SalesPage{}, fmt.Errorf("query backoffice sales: %w", err)
	}
	defer rows.Close()
	result := backofficedomain.SalesPage{
		Items: []backofficedomain.Sale{}, Total: total, Limit: filter.Limit, Offset: filter.Offset,
	}
	for rows.Next() {
		var item backofficedomain.Sale
		if err := rows.Scan(
			&item.ID, &item.CreatedAt, &item.PaidAt, &item.CustomerID,
			&item.CustomerName, &item.CustomerEmail, &item.BookID, &item.BookSlug,
			&item.BookTitle, &item.AmountMinorUnits, &item.Currency, &item.OrderStatus,
			&item.PaymentStatus, &item.PaymentProvider, &item.ProviderPaymentID, &item.DisplayStatus,
		); err != nil {
			return backofficedomain.SalesPage{}, fmt.Errorf("scan backoffice sale: %w", err)
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return backofficedomain.SalesPage{}, fmt.Errorf("iterate backoffice sales: %w", err)
	}
	return result, nil
}

func (r *BackofficeRepository) countSales(ctx context.Context, filter backofficedomain.SalesFilter) (int, error) {
	var total int
	err := r.pool.QueryRow(ctx, `
		WITH sale_rows AS (
			SELECT orders.id::text AS id, orders.created_at,
			       COALESCE(NULLIF(users.display_name, ''), split_part(users.email, '@', 1)) AS customer_name,
			       users.email AS customer_email, books.slug AS book_slug,
			       order_items.book_title,
			       CASE
			           WHEN orders.status = 'PAID' THEN 'APPROVED'
			           WHEN selected_payment.status = 'REFUNDED' THEN 'REFUNDED'
			           WHEN selected_payment.status = 'REJECTED' THEN 'REJECTED'
			           WHEN selected_payment.status = 'CANCELLED' THEN 'CANCELLED'
			           WHEN orders.status = 'EXPIRED' THEN 'EXPIRED'
			           ELSE 'PENDING'
			       END AS display_status
			FROM orders
			JOIN users ON users.id = orders.user_id
			JOIN order_items ON order_items.order_id = orders.id
			JOIN books ON books.id = order_items.book_id
			LEFT JOIN LATERAL (
				SELECT payments.status
				FROM payments
				WHERE payments.order_id = orders.id
				ORDER BY
					CASE WHEN orders.status = 'PAID' AND payments.status = 'APPROVED' THEN 0 ELSE 1 END,
					payments.updated_at DESC
				LIMIT 1
			) selected_payment ON true
		)
		SELECT count(*)::int
		FROM sale_rows
		WHERE ($1::timestamptz IS NULL OR created_at >= $1)
		  AND created_at <= $2
		  AND ($3 = '' OR book_slug = $3)
		  AND ($4 = '' OR display_status = $4)
		  AND ($5 = '' OR customer_name ILIKE '%' || $5 || '%'
		       OR customer_email ILIKE '%' || $5 || '%'
		       OR book_title ILIKE '%' || $5 || '%'
		       OR id = $5)`,
		filter.Period.From, filter.Period.To, filter.BookSlug, filter.Status, filter.Query,
	).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("count backoffice sales: %w", err)
	}
	return total, nil
}

func (r *BackofficeRepository) Customers(
	ctx context.Context,
	filter backofficedomain.CustomerFilter,
	adminGoogleSub, currency string,
) (backofficedomain.CustomerPage, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM users
		WHERE ($1 = '' OR users.google_subject <> $1)
		  AND ($2 = '' OR users.display_name ILIKE '%' || $2 || '%'
		       OR users.email ILIKE '%' || $2 || '%')`, adminGoogleSub, filter.Query).Scan(&total); err != nil {
		return backofficedomain.CustomerPage{}, fmt.Errorf("count backoffice customers: %w", err)
	}
	rows, err := r.pool.Query(ctx, `
		SELECT users.id::text, users.display_name, users.email,
		       users.picture_url, users.created_at, users.last_login_at,
		       COALESCE(stats.paid_orders_count, 0)::int,
		       COALESCE(purchases.books_purchased_count, 0)::int,
		       COALESCE(stats.total_spent_minor_units, 0)::bigint,
		       $4::text AS currency, stats.last_purchase_at,
		       COALESCE(purchases.purchased_books, '[]'::jsonb)
		FROM users
		LEFT JOIN LATERAL (
			SELECT count(*) FILTER (WHERE orders.currency = $4)::int AS paid_orders_count,
			       COALESCE(sum(orders.total_minor_units) FILTER (WHERE orders.currency = $4), 0)::bigint AS total_spent_minor_units,
			       max(orders.paid_at) AS last_purchase_at
			FROM orders
			WHERE orders.user_id = users.id AND orders.status = 'PAID'
		) stats ON true
		LEFT JOIN LATERAL (
			SELECT count(*)::int AS books_purchased_count,
			       jsonb_agg(
			           jsonb_build_object(
			               'id', purchased.book_id,
			               'slug', purchased.book_slug,
			               'title', purchased.book_title,
			               'purchasedAt', purchased.purchased_at
			           ) ORDER BY purchased.purchased_at DESC
			       ) AS purchased_books
			FROM (
				SELECT DISTINCT ON (order_items_inner.book_id)
				       order_items_inner.book_id::text AS book_id,
				       books.slug AS book_slug,
				       order_items_inner.book_title AS book_title,
				       orders_inner.paid_at AS purchased_at
				FROM orders orders_inner
				JOIN order_items order_items_inner ON order_items_inner.order_id = orders_inner.id
				JOIN books ON books.id = order_items_inner.book_id
				WHERE orders_inner.user_id = users.id AND orders_inner.status = 'PAID'
				ORDER BY order_items_inner.book_id, orders_inner.paid_at DESC
			) purchased
		) purchases ON true
		WHERE ($1 = '' OR users.google_subject <> $1)
		  AND ($2 = '' OR users.display_name ILIKE '%' || $2 || '%'
		       OR users.email ILIKE '%' || $2 || '%')
		ORDER BY stats.last_purchase_at DESC NULLS LAST, users.created_at DESC
		LIMIT $3 OFFSET $5`,
		adminGoogleSub, filter.Query, filter.Limit, currency, filter.Offset,
	)
	if err != nil {
		return backofficedomain.CustomerPage{}, fmt.Errorf("query backoffice customers: %w", err)
	}
	defer rows.Close()
	result := backofficedomain.CustomerPage{
		Items: []backofficedomain.Customer{}, Total: total, Limit: filter.Limit, Offset: filter.Offset,
	}
	for rows.Next() {
		var item backofficedomain.Customer
		var purchasedBooks []byte
		if err := rows.Scan(
			&item.ID, &item.DisplayName, &item.Email, &item.PictureURL,
			&item.CreatedAt, &item.LastLoginAt, &item.PaidOrdersCount,
			&item.BooksPurchasedCount, &item.TotalSpentMinorUnits, &item.Currency,
			&item.LastPurchaseAt, &purchasedBooks,
		); err != nil {
			return backofficedomain.CustomerPage{}, fmt.Errorf("scan backoffice customer: %w", err)
		}
		if err := json.Unmarshal(purchasedBooks, &item.PurchasedBooks); err != nil {
			return backofficedomain.CustomerPage{}, fmt.Errorf("decode customer purchased books: %w", err)
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return backofficedomain.CustomerPage{}, fmt.Errorf("iterate backoffice customers: %w", err)
	}
	return result, nil
}

func (r *BackofficeRepository) queryTrend(
	ctx context.Context,
	period backofficedomain.Period,
	bookSlug, currency string,
	now time.Time,
) ([]backofficedomain.TrendPoint, error) {
	bucket := "day"
	if period.Range == backofficedomain.RangeYear {
		bucket = "month"
	} else if period.Range == backofficedomain.RangeAll {
		bucket = "year"
	}
	rows, err := r.pool.Query(ctx, `
		SELECT date_trunc($1, orders.paid_at) AS period_start,
		       count(*)::int, COALESCE(sum(orders.total_minor_units), 0)::bigint
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		JOIN books ON books.id = order_items.book_id
		WHERE orders.status = 'PAID' AND orders.currency = $2
		  AND ($3::timestamptz IS NULL OR orders.paid_at >= $3)
		  AND orders.paid_at <= $4
		  AND ($5 = '' OR books.slug = $5)
		GROUP BY period_start
		ORDER BY period_start`, bucket, currency, period.From, period.To, bookSlug)
	if err != nil {
		return nil, fmt.Errorf("query dashboard trend: %w", err)
	}
	defer rows.Close()
	values := make(map[time.Time]backofficedomain.TrendPoint)
	for rows.Next() {
		var item backofficedomain.TrendPoint
		if err := rows.Scan(&item.PeriodStart, &item.SalesCount, &item.RevenueMinorUnits); err != nil {
			return nil, fmt.Errorf("scan dashboard trend: %w", err)
		}
		values[item.PeriodStart.UTC()] = item
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard trend: %w", err)
	}
	return fillTrend(period, now, values), nil
}

func fillTrend(period backofficedomain.Period, now time.Time, values map[time.Time]backofficedomain.TrendPoint) []backofficedomain.TrendPoint {
	if period.Range == backofficedomain.RangeAll {
		firstYear := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
		for point := range values {
			if point.Before(firstYear) {
				firstYear = point
			}
		}
		result := make([]backofficedomain.TrendPoint, 0, now.Year()-firstYear.Year()+1)
		for year := firstYear; !year.After(now); year = year.AddDate(1, 0, 0) {
			item := values[year]
			item.PeriodStart = year
			result = append(result, item)
		}
		return result
	}
	if period.From == nil {
		return []backofficedomain.TrendPoint{}
	}
	result := make([]backofficedomain.TrendPoint, 0)
	stepMonths, stepDays := 0, 1
	if period.Range == backofficedomain.RangeYear {
		stepMonths, stepDays = 1, 0
	}
	for point := *period.From; !point.After(now); point = point.AddDate(0, stepMonths, stepDays) {
		item := values[point]
		item.PeriodStart = point
		result = append(result, item)
	}
	return result
}

func (r *BackofficeRepository) queryTopBooks(ctx context.Context, period backofficedomain.Period, bookSlug, currency string) ([]backofficedomain.BookMetric, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT books.id::text, books.slug, order_items.book_title,
		       count(*)::int, COALESCE(sum(orders.total_minor_units), 0)::bigint
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		JOIN books ON books.id = order_items.book_id
		WHERE orders.status = 'PAID' AND orders.currency = $1
		  AND ($2::timestamptz IS NULL OR orders.paid_at >= $2)
		  AND orders.paid_at <= $3
		  AND ($4 = '' OR books.slug = $4)
		GROUP BY books.id, books.slug, order_items.book_title
		ORDER BY count(*) DESC, order_items.book_title
		LIMIT 10`, currency, period.From, period.To, bookSlug)
	if err != nil {
		return nil, fmt.Errorf("query dashboard top books: %w", err)
	}
	defer rows.Close()
	items := make([]backofficedomain.BookMetric, 0)
	for rows.Next() {
		var item backofficedomain.BookMetric
		if err := rows.Scan(&item.BookID, &item.BookSlug, &item.BookTitle, &item.SalesCount, &item.RevenueMinorUnits); err != nil {
			return nil, fmt.Errorf("scan dashboard top book: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard top books: %w", err)
	}
	return items, nil
}

func (r *BackofficeRepository) queryStatusCounts(ctx context.Context, period backofficedomain.Period, bookSlug string) ([]backofficedomain.StatusMetric, error) {
	rows, err := r.pool.Query(ctx, `
		WITH statuses AS (
			SELECT orders.created_at, books.slug,
			       CASE
			           WHEN orders.status = 'PAID' THEN 'APPROVED'
			           WHEN selected_payment.status = 'REFUNDED' THEN 'REFUNDED'
			           WHEN selected_payment.status = 'REJECTED' THEN 'REJECTED'
			           WHEN selected_payment.status = 'CANCELLED' THEN 'CANCELLED'
			           WHEN orders.status = 'EXPIRED' THEN 'EXPIRED'
			           ELSE 'PENDING'
			       END AS status
			FROM orders
			JOIN order_items ON order_items.order_id = orders.id
			JOIN books ON books.id = order_items.book_id
			LEFT JOIN LATERAL (
				SELECT payments.status
				FROM payments
				WHERE payments.order_id = orders.id
				ORDER BY
					CASE WHEN orders.status = 'PAID' AND payments.status = 'APPROVED' THEN 0 ELSE 1 END,
					payments.updated_at DESC
				LIMIT 1
			) selected_payment ON true
		)
		SELECT status, count(*)::int
		FROM statuses
		WHERE ($1::timestamptz IS NULL OR created_at >= $1)
		  AND created_at <= $2
		  AND ($3 = '' OR slug = $3)
		GROUP BY status ORDER BY status`, period.From, period.To, bookSlug)
	if err != nil {
		return nil, fmt.Errorf("query dashboard statuses: %w", err)
	}
	defer rows.Close()
	items := make([]backofficedomain.StatusMetric, 0)
	for rows.Next() {
		var item backofficedomain.StatusMetric
		if err := rows.Scan(&item.Status, &item.Count); err != nil {
			return nil, fmt.Errorf("scan dashboard status: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard statuses: %w", err)
	}
	return items, nil
}
