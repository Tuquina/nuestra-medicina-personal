//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	backofficedomain "github.com/nuestra-medicina-personal/backend/internal/domain/backoffice"
)

func TestBackofficeAggregatesHistoricalSalesAndCustomers(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const (
		adminID = "14000000-0000-4000-8000-000000000001"
		buyerID = "15000000-0000-4000-8000-000000000001"
		bookAID = "24000000-0000-4000-8000-000000000001"
		bookBID = "25000000-0000-4000-8000-000000000001"
		orderA  = "34000000-0000-4000-8000-000000000001"
		orderB  = "35000000-0000-4000-8000-000000000001"
		orderC  = "36000000-0000-4000-8000-000000000001"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM payments WHERE order_id IN ($1::uuid, $2::uuid, $3::uuid)`, orderA, orderB, orderC)
		_, _ = pool.Exec(ctx, `DELETE FROM order_items WHERE order_id IN ($1::uuid, $2::uuid, $3::uuid)`, orderA, orderB, orderC)
		_, _ = pool.Exec(ctx, `DELETE FROM orders WHERE id IN ($1::uuid, $2::uuid, $3::uuid)`, orderA, orderB, orderC)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id IN ($1::uuid, $2::uuid)`, bookAID, bookBID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1::uuid, $2::uuid)`, adminID, buyerID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, google_subject, email, display_name, created_at)
		VALUES
			($1::uuid, 'backoffice-admin', 'admin@example.com', 'Admin', '2026-01-01T00:00:00Z'),
			($2::uuid, 'backoffice-buyer', 'buyer.backoffice@example.com', 'María Compradora', '2026-01-02T00:00:00Z')`,
		adminID, buyerID); err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES
			($1::uuid, 'backoffice-book-a', 'Precio actual A', 9999, 'ARS', 'PUBLISHED'),
			($2::uuid, 'backoffice-book-b', 'Precio actual B', 9999, 'ARS', 'DRAFT')`,
		bookAID, bookBID); err != nil {
		t.Fatalf("seed books: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO orders (id, user_id, status, total_minor_units, currency, created_at, updated_at, paid_at)
		VALUES
			($1::uuid, $4::uuid, 'PAID', 10000, 'ARS', '2026-08-10T10:00:00Z', '2026-08-10T10:05:00Z', '2026-08-10T10:05:00Z'),
			($2::uuid, $4::uuid, 'PAID', 20000, 'ARS', '2026-08-11T10:00:00Z', '2026-08-11T10:05:00Z', '2026-08-11T10:05:00Z'),
			($3::uuid, $4::uuid, 'PENDING', 30000, 'ARS', '2026-08-12T10:00:00Z', '2026-08-12T10:05:00Z', NULL)`,
		orderA, orderB, orderC, buyerID); err != nil {
		t.Fatalf("seed orders: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO order_items (id, order_id, book_id, book_title, unit_price_minor_units, quantity, currency)
		VALUES
			('44000000-0000-4000-8000-000000000001', $1::uuid, $4::uuid, 'Título histórico A', 10000, 1, 'ARS'),
			('45000000-0000-4000-8000-000000000001', $2::uuid, $5::uuid, 'Título histórico B', 20000, 1, 'ARS'),
			('46000000-0000-4000-8000-000000000001', $3::uuid, $4::uuid, 'Título histórico A', 30000, 1, 'ARS')`,
		orderA, orderB, orderC, bookAID, bookBID); err != nil {
		t.Fatalf("seed order items: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO payments (
			id, order_id, provider, provider_payment_id, status, amount_minor_units,
			currency, raw_status, provider_payload, created_at, updated_at
		) VALUES
			('54000000-0000-4000-8000-000000000001', $1::uuid, 'MERCADO_PAGO', 'bo-approved-a', 'APPROVED', 10000, 'ARS', 'approved', '{}', '2026-08-10T10:04:00Z', '2026-08-10T10:04:00Z'),
			('54000000-0000-4000-8000-000000000002', $1::uuid, 'MERCADO_PAGO', 'bo-cancelled-a', 'CANCELLED', 10000, 'ARS', 'cancelled', '{}', '2026-08-10T10:06:00Z', '2026-08-10T10:06:00Z'),
			('55000000-0000-4000-8000-000000000001', $2::uuid, 'MERCADO_PAGO', 'bo-approved-b', 'APPROVED', 20000, 'ARS', 'approved', '{}', '2026-08-11T10:04:00Z', '2026-08-11T10:04:00Z'),
			('56000000-0000-4000-8000-000000000001', $3::uuid, 'MERCADO_PAGO', 'bo-rejected-c', 'REJECTED', 30000, 'ARS', 'rejected', '{}', '2026-08-12T10:04:00Z', '2026-08-12T10:04:00Z')`,
		orderA, orderB, orderC); err != nil {
		t.Fatalf("seed payments: %v", err)
	}

	repository := NewBackofficeRepository(pool)
	from := time.Date(2026, 8, 10, 0, 0, 0, 0, time.UTC)
	period := backofficedomain.Period{Range: backofficedomain.Range7Days, From: &from, To: time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)}
	dashboard, err := repository.Dashboard(ctx, period, "", "ARS", period.To)
	if err != nil {
		t.Fatalf("dashboard: %v", err)
	}
	if dashboard.ApprovedSalesCount != 2 || dashboard.RevenueMinorUnits != 30000 || dashboard.BuyersCount != 1 {
		t.Fatalf("unexpected dashboard metrics: %#v", dashboard)
	}

	sales, err := repository.Sales(ctx, backofficedomain.SalesFilter{Period: period, Limit: 50})
	if err != nil {
		t.Fatalf("sales: %v", err)
	}
	if sales.Total != 3 || len(sales.Items) != 3 {
		t.Fatalf("unexpected sales page: %#v", sales)
	}
	for _, sale := range sales.Items {
		if sale.ID == orderA && (sale.DisplayStatus != "APPROVED" || sale.BookTitle != "Título histórico A" || sale.AmountMinorUnits != 10000) {
			t.Fatalf("approved order chose wrong payment or live price: %#v", sale)
		}
	}

	customers, err := repository.Customers(ctx, backofficedomain.CustomerFilter{Limit: 50}, []string{"backoffice-admin"}, "ARS")
	if err != nil {
		t.Fatalf("customers: %v", err)
	}
	var buyer *backofficedomain.Customer
	for index := range customers.Items {
		if customers.Items[index].ID == buyerID {
			buyer = &customers.Items[index]
		}
		if customers.Items[index].ID == adminID {
			t.Fatal("administrator leaked into customer directory")
		}
	}
	if buyer == nil || buyer.PaidOrdersCount != 2 || buyer.BooksPurchasedCount != 2 || buyer.TotalSpentMinorUnits != 30000 || len(buyer.PurchasedBooks) != 2 {
		t.Fatalf("unexpected buyer aggregate: %#v", buyer)
	}
}
