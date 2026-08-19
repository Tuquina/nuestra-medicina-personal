//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

func TestSettingsRepositoryRoundTrip(t *testing.T) {
	pool, err := Open(context.Background(), os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	repository := NewSettingsRepository(pool)
	original, err := repository.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = repository.Update(context.Background(), original) })

	want := settingsdomain.Settings{
		SiteName: "Integration Site", SiteDescription: "Description",
		SupportEmail: "support@example.com", NewsletterEmail: "news@example.com",
		SenderName: "Integration Sender", SEOTitle: "SEO title",
		SEODescription: "SEO description", SEOIndexable: false,
		UpdatedAt: time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC),
	}
	got, err := repository.Update(context.Background(), want)
	if err != nil {
		t.Fatal(err)
	}
	if got.SiteName != want.SiteName || got.SupportEmail != want.SupportEmail || got.SEOIndexable {
		t.Fatalf("unexpected settings: %#v", got)
	}
}
