//go:build integration

package postgres

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

func TestPageDraftPublicationAndRestoreAgainstPostgres(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const (
		userID    = "12000000-0000-4000-8000-000000000001"
		bookID    = "22000000-0000-4000-8000-000000000001"
		pageID    = "32000000-0000-4000-8000-000000000001"
		versionID = "42000000-0000-4000-8000-000000000001"
		version2  = "42000000-0000-4000-8000-000000000002"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM page_versions WHERE page_id = $1::uuid`, pageID)
		_, _ = pool.Exec(ctx, `DELETE FROM pages WHERE id = $1::uuid`, pageID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, google_subject, email)
		VALUES ($1::uuid, 'page-integration-user', 'page-owner@example.com')`, userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES ($1::uuid, 'page-integration-book', 'Page integration book', 100, 'ARS', 'DRAFT')`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}

	repository := NewPageRepository(pool)
	now := time.Date(2026, 8, 19, 21, 0, 0, 0, time.UTC)
	draftA := contentWithHero(t, "Primer borrador")
	created, err := repository.Create(ctx, page.Page{
		ID: pageID, Type: "BOOK", BookID: pointer(bookID), Slug: "page-integration",
		Title: "Página de integración", DraftContent: draftA, CreatedAt: now,
	})
	if err != nil || created.Status != page.StatusDraft {
		t.Fatalf("create page: %#v %v", created, err)
	}

	draftB := contentWithHero(t, "Primera publicación")
	if _, err := repository.SaveDraft(ctx, pageID, draftB, now.Add(time.Minute)); err != nil {
		t.Fatalf("save first draft: %v", err)
	}
	if _, err := repository.Publish(ctx, pageID, versionID, userID, now.Add(2*time.Minute)); err != nil {
		t.Fatalf("publish first version: %v", err)
	}

	draftC := contentWithHero(t, "Segunda publicación")
	if _, err := repository.SaveDraft(ctx, pageID, draftC, now.Add(3*time.Minute)); err != nil {
		t.Fatalf("save second draft: %v", err)
	}
	publicBeforePublish, err := repository.GetPublished(ctx, "page-integration")
	if err != nil || heroTitle(t, *publicBeforePublish.PublishedContent) != "Primera publicación" {
		t.Fatalf("public page leaked draft: %#v %v", publicBeforePublish, err)
	}
	if _, err := repository.Publish(ctx, pageID, version2, userID, now.Add(4*time.Minute)); err != nil {
		t.Fatalf("publish second version: %v", err)
	}

	versions, err := repository.ListVersions(ctx, pageID)
	if err != nil || len(versions) != 2 || versions[0].VersionNumber != 2 {
		t.Fatalf("list versions: %#v %v", versions, err)
	}
	restored, err := repository.Restore(ctx, pageID, versionID, now.Add(5*time.Minute))
	if err != nil || heroTitle(t, restored.DraftContent) != "Primera publicación" {
		t.Fatalf("restore first version as draft: %#v %v", restored, err)
	}
	publicAfterRestore, err := repository.GetPublished(ctx, "page-integration")
	if err != nil || heroTitle(t, *publicAfterRestore.PublishedContent) != "Segunda publicación" {
		t.Fatalf("restore changed public content: %#v %v", publicAfterRestore, err)
	}
}

func TestEditorialSeedMigrationPublishesSingletonPage(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	seeded, err := NewPageRepository(pool).GetPublished(ctx, "contacto")
	if err != nil || seeded.Type != string(page.TypeContact) || seeded.BookID != nil || seeded.PublishedContent == nil {
		t.Fatalf("published contact seed: %#v %v", seeded, err)
	}
}

func TestBookUpdateKeepsItsCMSPageSlugAndTitleAligned(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	const (
		bookID = "22000000-0000-4000-8000-000000000002"
		pageID = "32000000-0000-4000-8000-000000000003"
	)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM pages WHERE id = $1::uuid`, pageID)
		_, _ = pool.Exec(ctx, `DELETE FROM books WHERE id = $1::uuid`, bookID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `
		INSERT INTO books (id, slug, title, price_minor_units, currency, status)
		VALUES ($1::uuid, 'cms-old-slug', 'Old title', 100, 'ARS', 'DRAFT')`, bookID); err != nil {
		t.Fatalf("seed book: %v", err)
	}
	content := contentWithHero(t, "Book page")
	if _, err := NewPageRepository(pool).Create(ctx, page.Page{
		ID: pageID, Type: string(page.TypeBook), BookID: pointer(bookID), Slug: "cms-old-slug",
		Title: "Old title", DraftContent: content, CreatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("seed page: %v", err)
	}

	books := NewBookRepository(pool)
	if _, err := pool.Exec(ctx, `UPDATE books SET status = 'PUBLISHED', published_at = now() WHERE id = $1::uuid`, bookID); err != nil {
		t.Fatalf("publish book fixture: %v", err)
	}
	if _, err := books.GetPublishedBySlug(ctx, "cms-old-slug"); err != book.ErrNotFound {
		t.Fatalf("book without a published landing must stay out of the public catalog: %v", err)
	}
	if published, err := books.HasPublishedLanding(ctx, bookID); err != nil || published {
		t.Fatalf("draft landing should not allow book publication: %v %v", published, err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE pages
		SET status = 'PUBLISHED', published_content = draft_content, published_at = now()
		WHERE id = $1::uuid`, pageID); err != nil {
		t.Fatalf("publish seeded landing: %v", err)
	}
	if published, err := books.HasPublishedLanding(ctx, bookID); err != nil || !published {
		t.Fatalf("published landing should allow book publication: %v %v", published, err)
	}
	if _, err := books.GetPublishedBySlug(ctx, "cms-old-slug"); err != nil {
		t.Fatalf("book with a published landing should resolve publicly: %v", err)
	}
	value, err := books.GetByIdentifier(ctx, bookID)
	if err != nil {
		t.Fatalf("get book: %v", err)
	}
	value.Slug = "cms-new-slug"
	value.Title = "New title"
	value.UpdatedAt = time.Now().UTC()
	if _, err := books.Update(ctx, value); err != nil {
		t.Fatalf("update book: %v", err)
	}

	updated, err := NewPageRepository(pool).Get(ctx, "cms-new-slug")
	if err != nil || updated.Title != "New title" || updated.BookID == nil || *updated.BookID != bookID {
		t.Fatalf("aligned page: %#v %v", updated, err)
	}
	if _, err := NewPageRepository(pool).Get(ctx, "cms-old-slug"); err != page.ErrNotFound {
		t.Fatalf("old page slug should not resolve: %v", err)
	}
}

func contentWithHero(t *testing.T, title string) page.Content {
	t.Helper()
	props, err := json.Marshal(map[string]any{
		"title": title, "subtitle": "", "imageId": nil, "alignment": "center", "cta": nil,
	})
	if err != nil {
		t.Fatalf("encode hero: %v", err)
	}
	return page.Content{SchemaVersion: 1, Sections: []page.Block{{ID: "hero", Type: "hero", Props: props}}}
}

func heroTitle(t *testing.T, content page.Content) string {
	t.Helper()
	var props struct {
		Title string `json:"title"`
	}
	if err := json.Unmarshal(content.Sections[0].Props, &props); err != nil {
		t.Fatalf("decode hero title: %v", err)
	}
	return props.Title
}

func pointer(value string) *string { return &value }
