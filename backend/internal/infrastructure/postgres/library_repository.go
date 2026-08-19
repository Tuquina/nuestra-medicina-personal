package postgres

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
)

type LibraryRepository struct {
	pool *pgxpool.Pool
}

func NewLibraryRepository(pool *pgxpool.Pool) *LibraryRepository {
	return &LibraryRepository{pool: pool}
}

func (r *LibraryRepository) ListForUser(ctx context.Context, userID string) ([]librarydomain.Book, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT books.id::text, books.slug, books.title, books.cover_media_id::text,
		       books.format, books.file_size_bytes, MAX(COALESCE(orders.paid_at, orders.updated_at)),
		       BOOL_OR(books.ebook_file_path IS NOT NULL AND books.ebook_file_path <> '')
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		JOIN books ON books.id = order_items.book_id
		WHERE orders.user_id = $1::uuid AND orders.status = 'PAID'
		GROUP BY books.id, books.slug, books.title, books.cover_media_id,
		         books.format, books.file_size_bytes
		ORDER BY MAX(COALESCE(orders.paid_at, orders.updated_at)) DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list purchased books: %w", err)
	}
	defer rows.Close()
	items := make([]librarydomain.Book, 0)
	for rows.Next() {
		var item librarydomain.Book
		if err := rows.Scan(
			&item.ID, &item.Slug, &item.Title, &item.CoverMediaID, &item.Format,
			&item.FileSizeBytes, &item.PurchasedAt, &item.DownloadAvailable,
		); err != nil {
			return nil, fmt.Errorf("scan purchased book: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate purchased books: %w", err)
	}
	return items, nil
}

func (r *LibraryRepository) GetDownloadForUser(ctx context.Context, userID, bookID string) (librarydomain.Download, error) {
	var value librarydomain.Download
	var title, format string
	err := r.pool.QueryRow(ctx, `
		SELECT books.ebook_file_path, order_items.book_title, books.format
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		JOIN books ON books.id = order_items.book_id
		WHERE orders.user_id = $1::uuid AND books.id::text = $2
		  AND orders.status = 'PAID'
		  AND books.ebook_file_path IS NOT NULL AND books.ebook_file_path <> ''
		ORDER BY orders.paid_at DESC
		LIMIT 1`, userID, bookID).Scan(&value.StorageKey, &title, &format)
	if errors.Is(err, pgx.ErrNoRows) {
		return librarydomain.Download{}, librarydomain.ErrBookNotAvailable
	}
	if err != nil {
		return librarydomain.Download{}, fmt.Errorf("authorize ebook download: %w", err)
	}
	extension := strings.ToLower(filepath.Ext(value.StorageKey))
	value.Filename = safeStoredFilename(title, extension)
	if strings.EqualFold(format, "epub") || extension == ".epub" {
		value.MediaType = "application/epub+zip"
	} else {
		value.MediaType = "application/pdf"
	}
	return value, nil
}

func (r *LibraryRepository) AttachEbook(ctx context.Context, bookID, storageKey, format string, size int64, now time.Time) (string, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("begin ebook attachment: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var previous *string
	err = tx.QueryRow(ctx, `SELECT ebook_file_path FROM books WHERE id = $1::uuid FOR UPDATE`, bookID).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", librarydomain.ErrBookNotAvailable
	}
	if err != nil {
		return "", fmt.Errorf("lock book for ebook attachment: %w", err)
	}
	command, err := tx.Exec(ctx, `
		UPDATE books
		SET ebook_file_path = $2, format = upper($3), file_size_bytes = $4, updated_at = $5
		WHERE id = $1::uuid`, bookID, storageKey, format, size, now)
	if err != nil {
		return "", fmt.Errorf("attach ebook to book: %w", err)
	}
	if command.RowsAffected() != 1 {
		return "", librarydomain.ErrBookNotAvailable
	}
	if previous == nil || *previous == "" {
		if err := enqueueEbookAvailableEmails(ctx, tx, bookID, now); err != nil {
			return "", fmt.Errorf("enqueue ebook available emails: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("commit ebook attachment: %w", err)
	}
	if previous == nil {
		return "", nil
	}
	return *previous, nil
}

func enqueueEbookAvailableEmails(ctx context.Context, tx pgx.Tx, bookID string, now time.Time) error {
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT ON (users.id)
		       users.id::text, users.email, orders.id::text, order_items.book_title,
		       orders.total_minor_units, orders.currency
		FROM orders
		JOIN users ON users.id = orders.user_id
		JOIN order_items ON order_items.order_id = orders.id
		WHERE order_items.book_id = $1::uuid AND orders.status = 'PAID'
		ORDER BY users.id, orders.paid_at DESC`, bookID)
	if err != nil {
		return fmt.Errorf("list buyers awaiting ebook: %w", err)
	}
	type buyer struct {
		userID, recipient, orderID, bookTitle, currency string
		amountMinorUnits                                int64
	}
	waiting := make([]buyer, 0)
	for rows.Next() {
		var value buyer
		if err := rows.Scan(
			&value.userID, &value.recipient, &value.orderID, &value.bookTitle,
			&value.amountMinorUnits, &value.currency,
		); err != nil {
			rows.Close()
			return fmt.Errorf("scan buyer awaiting ebook: %w", err)
		}
		waiting = append(waiting, value)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("iterate buyers awaiting ebook: %w", err)
	}
	rows.Close()

	for _, value := range waiting {
		jobID, err := databaseUUID()
		if err != nil {
			return fmt.Errorf("generate ebook email job id: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO email_jobs (id, type, recipient, payload, dedupe_key, next_attempt_at, created_at, updated_at)
			VALUES (
				$1::uuid, 'ebook.available', $2,
				jsonb_build_object(
					'orderId', $3::text,
					'bookTitle', $4::text,
					'amountMinorUnits', $5::bigint,
					'currency', $6::text,
					'ebookAvailable', true
				),
				$7, $8, $8, $8
			)
			ON CONFLICT (dedupe_key) DO NOTHING`,
			jobID, value.recipient, value.orderID, value.bookTitle,
			value.amountMinorUnits, value.currency,
			fmt.Sprintf("ebook:%s:%s", bookID, value.userID), now,
		); err != nil {
			return fmt.Errorf("insert ebook available email: %w", err)
		}
	}
	return nil
}

func safeStoredFilename(title, extension string) string {
	name := strings.Map(func(value rune) rune {
		if value >= 'a' && value <= 'z' || value >= 'A' && value <= 'Z' || value >= '0' && value <= '9' || value == ' ' || value == '-' || value == '_' {
			return value
		}
		return -1
	}, title)
	name = strings.TrimSpace(name)
	if name == "" {
		name = "ebook"
	}
	return name + extension
}
