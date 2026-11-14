//go:build integration

package postgres

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/application/pages"
	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

func TestMeditationPagesAreListedAndSeeded(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	repository := NewPageRepository(pool)
	listing := pages.NewListingService(repository)
	service := pages.NewService(repository)

	// Migration 016 seeds "Respirar y empezar", published, with a video.
	summaries, err := listing.ListPublishedMeditations(ctx)
	if err != nil {
		t.Fatalf("list published meditations: %v", err)
	}
	var seeded *page.MeditationSummary
	for index := range summaries {
		if summaries[index].Slug == "respirar-y-empezar" {
			seeded = &summaries[index]
		}
	}
	if seeded == nil || seeded.Title != "Respirar y empezar" || !seeded.HasVideo {
		t.Fatalf("expected the seeded meditation in the public list, got %+v", summaries)
	}

	// Several meditation pages can coexist (they are not singletons), and a
	// draft-only one is listed for the backoffice but not publicly.
	const slug = "integracion-meditacion-borrador"
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM pages WHERE slug = $1`, slug) })
	content, err := page.DecodeContent([]byte(`{"schemaVersion":1,"sections":[{"id":"meditation","type":"meditation","props":{"title":"Borrador","description":"Sin publicar","imageId":null,"imageAlt":"","video":null,"durationMinutes":null,"guidance":""}}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Create(ctx, page.Page{Type: string(page.TypeMeditation), Slug: slug, Title: "Borrador", DraftContent: content}); err != nil {
		t.Fatalf("create a second meditation page: %v", err)
	}
	all, err := listing.ListByType(ctx, string(page.TypeMeditation))
	if err != nil {
		t.Fatal(err)
	}
	foundDraft := false
	for _, value := range all {
		foundDraft = foundDraft || value.Slug == slug
	}
	if !foundDraft || len(all) < 2 {
		t.Fatalf("expected the draft in the backoffice listing, got %d pages", len(all))
	}
	public, _ := listing.ListPublishedMeditations(ctx)
	for _, summary := range public {
		if summary.Slug == slug {
			t.Fatal("a draft-only meditation must not be listed publicly")
		}
	}

	// The placeholder card it replaces is gone from the Meditaciones collection.
	var published string
	if err := pool.QueryRow(ctx, `SELECT published_content::text FROM pages WHERE slug = 'meditaciones'`).Scan(&published); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(published, `"card-1"`) {
		t.Fatal("expected migration 016 to drop the 'Respirar y empezar' placeholder card")
	}
}
