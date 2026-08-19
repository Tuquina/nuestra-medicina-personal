package pages

import (
	"context"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type fakeRepository struct {
	created   page.Page
	saved     page.Content
	published bool
	restored  string
}

func (repository *fakeRepository) Create(_ context.Context, value page.Page) (page.Page, error) {
	repository.created = value
	return value, nil
}
func (*fakeRepository) Get(context.Context, string) (page.Page, error) { return page.Page{}, nil }
func (*fakeRepository) GetPublished(context.Context, string) (page.Page, error) {
	return page.Page{}, nil
}
func (repository *fakeRepository) SaveDraft(_ context.Context, _ string, content page.Content, _ time.Time) (page.Page, error) {
	repository.saved = content
	return page.Page{DraftContent: content}, nil
}
func (repository *fakeRepository) Publish(_ context.Context, _, _, _ string, _ time.Time) (page.Page, error) {
	repository.published = true
	return page.Page{Status: page.StatusPublished}, nil
}
func (*fakeRepository) ListVersions(context.Context, string) ([]page.Version, error) { return nil, nil }
func (repository *fakeRepository) Restore(_ context.Context, _, versionID string, _ time.Time) (page.Page, error) {
	repository.restored = versionID
	return page.Page{}, nil
}

func TestCreateAppliesEditorialDefaults(t *testing.T) {
	repository := &fakeRepository{}
	service := NewService(repository)
	service.now = func() time.Time { return time.Date(2026, 8, 19, 20, 0, 0, 0, time.UTC) }
	service.newID = func() (string, error) { return "10000000-0000-4000-8000-000000000001", nil }

	created, err := service.Create(context.Background(), page.Page{Type: "HOME", Slug: "home", Title: "Inicio"})
	if err != nil {
		t.Fatalf("create page: %v", err)
	}
	if created.Status != page.StatusDraft || created.DraftContent.SchemaVersion != 1 || created.DraftContent.Sections == nil {
		t.Fatalf("unexpected defaults: %#v", created)
	}
}

func TestSaveDraftRejectsUnsafeContentBeforeRepository(t *testing.T) {
	repository := &fakeRepository{}
	service := NewService(repository)
	content := page.Content{SchemaVersion: 1, Sections: []page.Block{{ID: "raw", Type: "html", Props: []byte(`{"html":"<script>"}`)}}}
	if _, err := service.SaveDraft(context.Background(), "home", content); err == nil {
		t.Fatal("expected validation error")
	}
	if repository.saved.Sections != nil {
		t.Fatal("repository must not receive invalid content")
	}
}
