package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

const mediaColumns = `
id::text, filename, original_filename, storage_path, mime_type, size_bytes,
width, height, created_at, updated_at`

type MediaRepository struct {
	pool *pgxpool.Pool
}

func NewMediaRepository(pool *pgxpool.Pool) *MediaRepository { return &MediaRepository{pool: pool} }

func (r *MediaRepository) List(ctx context.Context) ([]mediadomain.Asset, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+mediaColumns+` FROM media ORDER BY created_at DESC, id`)
	if err != nil {
		return nil, fmt.Errorf("query media: %w", err)
	}
	defer rows.Close()
	items := make([]mediadomain.Asset, 0)
	for rows.Next() {
		item, err := scanMedia(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate media: %w", err)
	}
	return items, nil
}

func (r *MediaRepository) Create(ctx context.Context, value mediadomain.Asset) (mediadomain.Asset, error) {
	return scanMedia(r.pool.QueryRow(ctx, `
		INSERT INTO media (
			id, filename, original_filename, storage_path, mime_type, size_bytes,
			width, height, created_at, updated_at
		) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		RETURNING `+mediaColumns,
		value.ID, value.Filename, value.OriginalFilename, value.StoragePath, value.MIMEType,
		value.SizeBytes, value.Width, value.Height, value.CreatedAt,
	))
}

func (r *MediaRepository) Delete(ctx context.Context, identifier string) (mediadomain.Asset, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return mediadomain.Asset{}, fmt.Errorf("begin media deletion: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var value mediadomain.Asset
	var inUse bool
	err = tx.QueryRow(ctx, `
		SELECT `+qualifiedMediaColumns("media")+`,
		       EXISTS (SELECT 1 FROM books WHERE books.cover_media_id = media.id)
		       OR EXISTS (
		           SELECT 1 FROM pages
		           WHERE jsonb_path_exists(pages.draft_content, '$.** ? (@ == $mediaId)', jsonb_build_object('mediaId', to_jsonb(media.id::text)))
		              OR jsonb_path_exists(pages.published_content, '$.** ? (@ == $mediaId)', jsonb_build_object('mediaId', to_jsonb(media.id::text)))
		       )
		       OR EXISTS (
		           SELECT 1 FROM page_versions
		           WHERE jsonb_path_exists(page_versions.content, '$.** ? (@ == $mediaId)', jsonb_build_object('mediaId', to_jsonb(media.id::text)))
		       ) AS in_use
		FROM media
		WHERE media.id::text = $1
		FOR UPDATE`, identifier).Scan(
		&value.ID, &value.Filename, &value.OriginalFilename, &value.StoragePath,
		&value.MIMEType, &value.SizeBytes, &value.Width, &value.Height,
		&value.CreatedAt, &value.UpdatedAt, &inUse,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return mediadomain.Asset{}, mediadomain.ErrNotFound
	}
	if err != nil {
		return mediadomain.Asset{}, fmt.Errorf("lock media for deletion: %w", err)
	}
	if inUse {
		return mediadomain.Asset{}, mediadomain.ErrInUse
	}
	if _, err := tx.Exec(ctx, `DELETE FROM media WHERE id = $1::uuid`, value.ID); err != nil {
		return mediadomain.Asset{}, fmt.Errorf("delete media metadata: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return mediadomain.Asset{}, fmt.Errorf("commit media deletion: %w", err)
	}
	return value, nil
}

func qualifiedMediaColumns(table string) string {
	return table + `.id::text, ` + table + `.filename, ` + table + `.original_filename, ` +
		table + `.storage_path, ` + table + `.mime_type, ` + table + `.size_bytes, ` +
		table + `.width, ` + table + `.height, ` + table + `.created_at, ` + table + `.updated_at`
}

func scanMedia(row rowScanner) (mediadomain.Asset, error) {
	var value mediadomain.Asset
	err := row.Scan(
		&value.ID, &value.Filename, &value.OriginalFilename, &value.StoragePath,
		&value.MIMEType, &value.SizeBytes, &value.Width, &value.Height,
		&value.CreatedAt, &value.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return mediadomain.Asset{}, mediadomain.ErrNotFound
	}
	if err != nil {
		return mediadomain.Asset{}, fmt.Errorf("scan media: %w", err)
	}
	return value, nil
}
