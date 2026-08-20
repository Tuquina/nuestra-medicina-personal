package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

const bookColumns = `
id::text, slug, title, subtitle, author_name, category, variant,
short_description, price_minor_units, currency, isbn, publication_date,
publication_date_label, format, file_size_bytes, cover_media_id::text,
cover_caption, ebook_file_path, status, seo_title, seo_description,
seo_indexable, created_at, updated_at, published_at`

type BookRepository struct {
	pool *pgxpool.Pool
}

func NewBookRepository(pool *pgxpool.Pool) *BookRepository {
	return &BookRepository{pool: pool}
}

func (r *BookRepository) ListPublished(ctx context.Context) ([]book.Book, error) {
	return r.list(ctx, `SELECT `+bookColumns+` FROM books WHERE status = 'PUBLISHED' ORDER BY published_at DESC, title`)
}

func (r *BookRepository) GetPublishedBySlug(ctx context.Context, slug string) (book.Book, error) {
	return scanBook(r.pool.QueryRow(ctx, `SELECT `+bookColumns+` FROM books WHERE slug = $1 AND status = 'PUBLISHED'`, slug))
}

func (r *BookRepository) ListAll(ctx context.Context) ([]book.Book, error) {
	return r.list(ctx, `SELECT `+bookColumns+` FROM books ORDER BY updated_at DESC, title`)
}

func (r *BookRepository) GetByIdentifier(ctx context.Context, identifier string) (book.Book, error) {
	return scanBook(r.pool.QueryRow(ctx, `
		SELECT `+bookColumns+`
		FROM books
		WHERE id::text = $1 OR slug = $1
		LIMIT 1`, identifier))
}

func (r *BookRepository) Create(ctx context.Context, value book.Book) (book.Book, error) {
	result, err := scanBook(r.pool.QueryRow(ctx, `
		INSERT INTO books (
			id, slug, title, subtitle, author_name, category, variant,
			short_description, price_minor_units, currency, isbn, publication_date,
			publication_date_label, format, file_size_bytes, cover_media_id,
			cover_caption, ebook_file_path, status, seo_title, seo_description,
			seo_indexable, created_at, updated_at, published_at
		) VALUES (
			$1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
			$14, $15, $16::uuid, $17, $18, $19, $20, $21, $22, $23, $24, $25
		)
		RETURNING `+bookColumns,
		value.ID, value.Slug, value.Title, value.Subtitle, value.AuthorName, value.Category,
		value.Variant, value.ShortDescription, value.PriceMinorUnits, value.Currency, value.ISBN,
		value.PublicationDate, value.PublicationDateLabel, value.Format, value.FileSizeBytes,
		value.CoverMediaID, value.CoverCaption, value.EbookFilePath, value.Status, value.SEOTitle,
		value.SEODescription, value.SEOIndexable, value.CreatedAt, value.UpdatedAt, value.PublishedAt,
	))
	return result, normalizeBookError(err)
}

func (r *BookRepository) Update(ctx context.Context, value book.Book) (book.Book, error) {
	result, err := scanBook(r.pool.QueryRow(ctx, `
		WITH updated_book AS (
			UPDATE books SET
			slug = $2, title = $3, subtitle = $4, author_name = $5, category = $6,
			variant = $7, short_description = $8, price_minor_units = $9, currency = $10,
			isbn = $11, publication_date = $12, publication_date_label = $13, format = $14,
			file_size_bytes = $15, cover_media_id = $16::uuid, cover_caption = $17,
			ebook_file_path = $18, status = $19, seo_title = $20, seo_description = $21,
			seo_indexable = $22, updated_at = $23, published_at = $24
			WHERE id = $1::uuid
			RETURNING *
		), updated_page AS (
			UPDATE pages
			SET slug = $2, title = $3, updated_at = $23
			WHERE type = 'BOOK' AND book_id = $1::uuid
			RETURNING id
		)
		SELECT `+bookColumns+` FROM updated_book`,
		value.ID, value.Slug, value.Title, value.Subtitle, value.AuthorName, value.Category,
		value.Variant, value.ShortDescription, value.PriceMinorUnits, value.Currency, value.ISBN,
		value.PublicationDate, value.PublicationDateLabel, value.Format, value.FileSizeBytes,
		value.CoverMediaID, value.CoverCaption, value.EbookFilePath, value.Status, value.SEOTitle,
		value.SEODescription, value.SEOIndexable, value.UpdatedAt, value.PublishedAt,
	))
	return result, normalizeBookError(err)
}

func (r *BookRepository) Archive(ctx context.Context, identifier string, now time.Time) error {
	command, err := r.pool.Exec(ctx, `
		UPDATE books SET status = 'ARCHIVED', updated_at = $2
		WHERE id::text = $1 OR slug = $1`, identifier, now)
	if err != nil {
		return fmt.Errorf("archive book: %w", err)
	}
	if command.RowsAffected() == 0 {
		return book.ErrNotFound
	}
	return nil
}

func (r *BookRepository) list(ctx context.Context, query string) ([]book.Book, error) {
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query books: %w", err)
	}
	defer rows.Close()

	items := make([]book.Book, 0)
	for rows.Next() {
		item, err := scanBook(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate books: %w", err)
	}
	return items, nil
}

type rowScanner interface {
	Scan(...any) error
}

func scanBook(row rowScanner) (book.Book, error) {
	var value book.Book
	err := row.Scan(
		&value.ID, &value.Slug, &value.Title, &value.Subtitle, &value.AuthorName,
		&value.Category, &value.Variant, &value.ShortDescription, &value.PriceMinorUnits,
		&value.Currency, &value.ISBN, &value.PublicationDate, &value.PublicationDateLabel,
		&value.Format, &value.FileSizeBytes, &value.CoverMediaID, &value.CoverCaption,
		&value.EbookFilePath, &value.Status, &value.SEOTitle, &value.SEODescription,
		&value.SEOIndexable, &value.CreatedAt, &value.UpdatedAt, &value.PublishedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return book.Book{}, book.ErrNotFound
	}
	if err != nil {
		return book.Book{}, fmt.Errorf("scan book: %w", err)
	}
	return value, nil
}

func normalizeBookError(err error) error {
	if err == nil || errors.Is(err, book.ErrNotFound) {
		return err
	}
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" &&
		(postgresError.ConstraintName == "books_slug_key" || postgresError.ConstraintName == "pages_slug_key") {
		return book.ErrSlugConflict
	}
	return err
}
