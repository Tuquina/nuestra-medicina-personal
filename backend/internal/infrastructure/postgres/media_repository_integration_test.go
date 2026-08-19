//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

func TestMediaCannotBeDeletedWhileReferencedByPage(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()
	const (
		mediaID = "13000000-0000-4000-8000-000000000001"
		bookID  = "23000000-0000-4000-8000-000000000001"
		pageID  = "33000000-0000-4000-8000-000000000001"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM pages WHERE id = $1::uuid`, pageID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
		_, _ = pool.Exec(ctx, `DELETE FROM media WHERE id = $1::uuid`, mediaID)
	}
	cleanup()
	t.Cleanup(cleanup)
	now := time.Date(2026, 8, 19, 23, 0, 0, 0, time.UTC)
	repository := NewMediaRepository(pool)
	created, err := repository.Create(ctx, mediadomain.Asset{
		ID: mediaID, Filename: mediaID + ".png", OriginalFilename: "cover.png",
		StoragePath: mediaID + ".png", MIMEType: "image/png", SizeBytes: 100,
		Width: 10, Height: 20, CreatedAt: now,
	})
	if err != nil || created.Width != 10 {
		t.Fatalf("create media: %#v %v", created, err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES ($1::uuid, 'media-integration-book', 'Media integration', 100, 'ARS', 'DRAFT')`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO pages (id, type, book_id, slug, title, draft_content)
		VALUES (
			$1::uuid, 'BOOK', $2::uuid, 'media-integration-page', 'Media page',
			jsonb_build_object(
				'schemaVersion', 1,
				'sections', jsonb_build_array(jsonb_build_object(
					'id', 'hero', 'type', 'hero',
					'props', jsonb_build_object('title', 'Hero', 'subtitle', '', 'imageId', $3::text, 'alignment', 'center', 'cta', null)
				))
			)
		)`, pageID, bookID, mediaID); err != nil {
		t.Fatalf("seed page: %v", err)
	}
	if _, err := repository.Delete(ctx, mediaID); !errors.Is(err, mediadomain.ErrInUse) {
		t.Fatalf("expected media in use, got %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM pages WHERE id = $1::uuid`, pageID); err != nil {
		t.Fatalf("remove page reference: %v", err)
	}
	deleted, err := repository.Delete(ctx, mediaID)
	if err != nil || deleted.StoragePath != mediaID+".png" {
		t.Fatalf("delete unreferenced media: %#v %v", deleted, err)
	}
}
