package books

import (
	"context"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

type repositoryStub struct {
	created  book.Book
	archived string
	existing book.Book
}

func (r *repositoryStub) ListPublished(context.Context) ([]book.Book, error) { return nil, nil }
func (r *repositoryStub) GetPublishedBySlug(context.Context, string) (book.Book, error) {
	return book.Book{}, book.ErrNotFound
}
func (r *repositoryStub) ListAll(context.Context) ([]book.Book, error) { return nil, nil }
func (r *repositoryStub) GetByIdentifier(context.Context, string) (book.Book, error) {
	if r.existing.ID == "" {
		return book.Book{}, book.ErrNotFound
	}
	return r.existing, nil
}
func (r *repositoryStub) Create(_ context.Context, value book.Book) (book.Book, error) {
	r.created = value
	return value, nil
}
func (r *repositoryStub) Update(_ context.Context, value book.Book) (book.Book, error) {
	return value, nil
}
func (r *repositoryStub) Archive(_ context.Context, identifier string, _ time.Time) error {
	r.archived = identifier
	return nil
}

func TestCreateAppliesIdentityAndPublicationTime(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(repository)
	now := time.Date(2026, 8, 19, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	service.newID = func() (string, error) { return "b1d6e76e-6c3a-4fe5-906a-8f248d88023d", nil }

	created, err := service.Create(context.Background(), book.Book{
		Slug: "un-libro", Title: "Un libro", PriceMinorUnits: 1000,
		Currency: "ars", Variant: "gold", Status: book.StatusPublished,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.ID == "" || created.Currency != "ARS" || created.PublishedAt == nil || !created.PublishedAt.Equal(now) {
		t.Fatalf("unexpected created book: %#v", created)
	}
}

func TestArchiveDelegatesWithoutDeleting(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(repository)
	if err := service.Archive(context.Background(), "un-libro"); err != nil {
		t.Fatalf("archive: %v", err)
	}
	if repository.archived != "un-libro" {
		t.Fatalf("expected archive identifier, got %q", repository.archived)
	}
}

func TestUpdatePreservesServerManagedEbookPath(t *testing.T) {
	t.Parallel()
	path := "/data/ebooks/server-managed.epub"
	repository := &repositoryStub{existing: book.Book{
		ID: "b1d6e76e-6c3a-4fe5-906a-8f248d88023d", Slug: "antes", Title: "Antes",
		EbookFilePath: &path, CreatedAt: time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
	}}
	service := NewService(repository)
	updated, err := service.Update(context.Background(), "antes", book.Book{
		Slug: "despues", Title: "Después", Currency: "ARS", Variant: "blue", Status: book.StatusDraft,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.EbookFilePath == nil || *updated.EbookFilePath != path {
		t.Fatalf("server-managed path was not preserved: %#v", updated.EbookFilePath)
	}
}
