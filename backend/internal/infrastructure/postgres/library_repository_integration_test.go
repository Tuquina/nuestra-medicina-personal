//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
)

func TestLibraryOnlyExposesPaidBooksOwnedByUser(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const (
		userID      = "11000000-0000-4000-8000-000000000001"
		otherUserID = "11000000-0000-4000-8000-000000000002"
		bookID      = "21000000-0000-4000-8000-000000000001"
		orderID     = "31000000-0000-4000-8000-000000000001"
		itemID      = "41000000-0000-4000-8000-000000000001"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM order_items WHERE order_id = $1::uuid`, orderID)
		_, _ = pool.Exec(ctx, `DELETE FROM orders WHERE id = $1::uuid`, orderID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1::uuid, $2::uuid)`, userID, otherUserID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, google_subject, email) VALUES
		($1::uuid, 'library-owner', 'owner@example.com'),
		($2::uuid, 'library-other', 'other@example.com')`, userID, otherUserID); err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status, ebook_file_path, format, file_size_bytes)
		VALUES ($1::uuid, 'library-book', 'Library book', 10000, 'ARS', 'PUBLISHED', 'old.pdf', 'PDF', 8)`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}
	paidAt := time.Date(2026, 8, 19, 18, 0, 0, 0, time.UTC)
	if _, err := pool.Exec(ctx, `
		INSERT INTO orders (id, user_id, status, total_minor_units, currency, created_at, updated_at, paid_at)
		VALUES ($1::uuid, $2::uuid, 'PAID', 10000, 'ARS', $3, $3, $3)`, orderID, userID, paidAt); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO order_items (id, order_id, book_id, book_title, unit_price_minor_units, quantity, currency)
		VALUES ($1::uuid, $2::uuid, $3::uuid, 'Historical title', 10000, 1, 'ARS')`, itemID, orderID, bookID); err != nil {
		t.Fatalf("seed order item: %v", err)
	}

	repository := NewLibraryRepository(pool)
	items, err := repository.ListForUser(ctx, userID)
	if err != nil || len(items) != 1 || items[0].ID != bookID || !items[0].DownloadAvailable {
		t.Fatalf("owner library: %#v, %v", items, err)
	}
	download, err := repository.GetDownloadForUser(ctx, userID, bookID)
	if err != nil || download.StorageKey != "old.pdf" || download.MediaType != "application/pdf" {
		t.Fatalf("owner download: %#v, %v", download, err)
	}
	if _, err := repository.GetDownloadForUser(ctx, otherUserID, bookID); !errors.Is(err, librarydomain.ErrBookNotAvailable) {
		t.Fatalf("expected other user denial, got %v", err)
	}
	previous, err := repository.AttachEbook(ctx, bookID, "new.epub", "epub", 42, paidAt.Add(time.Minute))
	if err != nil || previous != "old.pdf" {
		t.Fatalf("replace ebook: previous=%q err=%v", previous, err)
	}
}
