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
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("commit ebook attachment: %w", err)
	}
	if previous == nil {
		return "", nil
	}
	return *previous, nil
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
