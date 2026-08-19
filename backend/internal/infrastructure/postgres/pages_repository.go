package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

const pageColumns = `
id::text, type, book_id::text, slug, title, status, draft_content,
published_content, created_at, updated_at, published_at`

type PageRepository struct {
	pool *pgxpool.Pool
}

func NewPageRepository(pool *pgxpool.Pool) *PageRepository { return &PageRepository{pool: pool} }

func (r *PageRepository) Create(ctx context.Context, value page.Page) (page.Page, error) {
	draft, err := json.Marshal(value.DraftContent)
	if err != nil {
		return page.Page{}, fmt.Errorf("encode page draft: %w", err)
	}
	created, err := scanPage(r.pool.QueryRow(ctx, `
		INSERT INTO pages (
			id, type, book_id, slug, title, status, draft_content,
			created_at, updated_at
		) VALUES ($1::uuid, $2, $3::uuid, $4, $5, 'DRAFT', $6::jsonb, $7, $7)
		RETURNING `+pageColumns,
		value.ID, value.Type, value.BookID, value.Slug, value.Title, draft, value.CreatedAt,
	))
	return created, normalizePageError(err)
}

func (r *PageRepository) Get(ctx context.Context, identifier string) (page.Page, error) {
	return scanPage(r.pool.QueryRow(ctx, `
		SELECT `+pageColumns+`
		FROM pages
		WHERE id::text = $1 OR slug = $1
		LIMIT 1`, identifier))
}

func (r *PageRepository) GetPublished(ctx context.Context, slug string) (page.Page, error) {
	return scanPage(r.pool.QueryRow(ctx, `
		SELECT `+pageColumns+`
		FROM pages
		WHERE slug = $1 AND status = 'PUBLISHED' AND published_content IS NOT NULL`, slug))
}

func (r *PageRepository) SaveDraft(ctx context.Context, identifier string, content page.Content, now time.Time) (page.Page, error) {
	encoded, err := json.Marshal(content)
	if err != nil {
		return page.Page{}, fmt.Errorf("encode page draft: %w", err)
	}
	return scanPage(r.pool.QueryRow(ctx, `
		UPDATE pages
		SET draft_content = $2::jsonb, updated_at = $3
		WHERE id::text = $1 OR slug = $1
		RETURNING `+pageColumns, identifier, encoded, now))
}

func (r *PageRepository) Publish(ctx context.Context, identifier, versionID, actorID string, now time.Time) (page.Page, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return page.Page{}, fmt.Errorf("begin page publication: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var pageID string
	var draft []byte
	err = tx.QueryRow(ctx, `
		SELECT id::text, draft_content
		FROM pages
		WHERE id::text = $1 OR slug = $1
		FOR UPDATE`, identifier).Scan(&pageID, &draft)
	if errors.Is(err, pgx.ErrNoRows) {
		return page.Page{}, page.ErrNotFound
	}
	if err != nil {
		return page.Page{}, fmt.Errorf("lock page for publication: %w", err)
	}
	if _, err := page.DecodeContent(draft); err != nil {
		return page.Page{}, fmt.Errorf("validate stored page draft: %w", err)
	}
	var versionNumber int
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(version_number), 0) + 1
		FROM page_versions
		WHERE page_id = $1::uuid`, pageID).Scan(&versionNumber); err != nil {
		return page.Page{}, fmt.Errorf("select next page version: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO page_versions (id, page_id, version_number, content, created_by, created_at)
		VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::uuid, $6)`,
		versionID, pageID, versionNumber, draft, actorID, now,
	); err != nil {
		return page.Page{}, fmt.Errorf("insert page version: %w", err)
	}
	published, err := scanPage(tx.QueryRow(ctx, `
		UPDATE pages
		SET status = 'PUBLISHED', published_content = draft_content,
		    published_at = $2, updated_at = $2
		WHERE id = $1::uuid
		RETURNING `+pageColumns, pageID, now))
	if err != nil {
		return page.Page{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return page.Page{}, fmt.Errorf("commit page publication: %w", err)
	}
	return published, nil
}

func (r *PageRepository) ListVersions(ctx context.Context, identifier string) ([]page.Version, error) {
	current, err := r.Get(ctx, identifier)
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, page_id::text, version_number, content, created_by::text, created_at
		FROM page_versions
		WHERE page_id = $1::uuid
		ORDER BY version_number DESC`, current.ID)
	if err != nil {
		return nil, fmt.Errorf("query page versions: %w", err)
	}
	defer rows.Close()
	versions := make([]page.Version, 0)
	for rows.Next() {
		var version page.Version
		var content []byte
		if err := rows.Scan(
			&version.ID, &version.PageID, &version.VersionNumber, &content,
			&version.CreatedBy, &version.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan page version: %w", err)
		}
		version.Content, err = page.DecodeContent(content)
		if err != nil {
			return nil, fmt.Errorf("decode page version: %w", err)
		}
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate page versions: %w", err)
	}
	return versions, nil
}

func (r *PageRepository) Restore(ctx context.Context, identifier, versionID string, now time.Time) (page.Page, error) {
	restored, err := scanPage(r.pool.QueryRow(ctx, `
		UPDATE pages
		SET draft_content = page_versions.content, updated_at = $3
		FROM page_versions
		WHERE (pages.id::text = $1 OR pages.slug = $1)
		  AND page_versions.id::text = $2
		  AND page_versions.page_id = pages.id
		RETURNING `+qualifiedPageColumns("pages"), identifier, versionID, now))
	if errors.Is(err, page.ErrNotFound) {
		return page.Page{}, page.ErrVersionNotFound
	}
	return restored, err
}

func qualifiedPageColumns(table string) string {
	return table + `.id::text, ` + table + `.type, ` + table + `.book_id::text, ` +
		table + `.slug, ` + table + `.title, ` + table + `.status, ` +
		table + `.draft_content, ` + table + `.published_content, ` +
		table + `.created_at, ` + table + `.updated_at, ` + table + `.published_at`
}

func scanPage(row rowScanner) (page.Page, error) {
	var value page.Page
	var draft, published []byte
	err := row.Scan(
		&value.ID, &value.Type, &value.BookID, &value.Slug, &value.Title, &value.Status,
		&draft, &published, &value.CreatedAt, &value.UpdatedAt, &value.PublishedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return page.Page{}, page.ErrNotFound
	}
	if err != nil {
		return page.Page{}, fmt.Errorf("scan page: %w", err)
	}
	value.DraftContent, err = page.DecodeContent(draft)
	if err != nil {
		return page.Page{}, fmt.Errorf("decode page draft: %w", err)
	}
	if len(published) > 0 {
		content, decodeErr := page.DecodeContent(published)
		if decodeErr != nil {
			return page.Page{}, fmt.Errorf("decode published page: %w", decodeErr)
		}
		value.PublishedContent = &content
	}
	return value, nil
}

func normalizePageError(err error) error {
	if err == nil || errors.Is(err, page.ErrNotFound) {
		return err
	}
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) {
		return err
	}
	if postgresError.Code == "23503" && postgresError.ConstraintName == "pages_book_id_fkey" {
		return page.ErrBookNotFound
	}
	if postgresError.Code == "23505" {
		switch postgresError.ConstraintName {
		case "pages_slug_key":
			return page.ErrSlugConflict
		case "pages_one_home_idx", "pages_one_page_per_book_idx":
			return page.ErrPageExists
		}
	}
	return err
}
