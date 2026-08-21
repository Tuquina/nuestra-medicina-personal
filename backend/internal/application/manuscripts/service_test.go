package manuscripts

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type booksStub struct {
	value book.Book
	err   error
}

func (s booksStub) Get(context.Context, string) (book.Book, error) { return s.value, s.err }

type repositoryStub struct {
	saved manuscript.Manuscript
	err   error
}

func (r *repositoryStub) Get(context.Context, string) (manuscript.Manuscript, error) {
	return manuscript.Manuscript{}, manuscript.ErrNotFound
}
func (r *repositoryStub) Save(_ context.Context, value manuscript.Manuscript) (manuscript.Manuscript, error) {
	if r.err != nil {
		return manuscript.Manuscript{}, r.err
	}
	r.saved = value
	return value, nil
}

func TestGetReturnsEmptyManuscriptWhenNoneSaved(t *testing.T) {
	t.Parallel()
	service := NewService(&repositoryStub{}, booksStub{value: book.Book{ID: "book-id"}})
	value, err := service.Get(context.Background(), "book-slug")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if value.BookID != "book-id" || value.Chapters == nil || len(value.Chapters) != 0 {
		t.Fatalf("expected empty not-started manuscript, got %#v", value)
	}
}

func TestGetPropagatesBookNotFound(t *testing.T) {
	t.Parallel()
	service := NewService(&repositoryStub{}, booksStub{err: book.ErrNotFound})
	if _, err := service.Get(context.Background(), "missing"); !errors.Is(err, book.ErrNotFound) {
		t.Fatalf("expected book not found, got %v", err)
	}
}

func TestSaveResolvesIdentifierToBookIDAndStampsUpdatedAt(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(repository, booksStub{value: book.Book{ID: "book-id"}})
	now := time.Date(2026, 8, 21, 9, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	saved, err := service.Save(context.Background(), "book-slug", []manuscript.Chapter{{ID: 1, Title: "Cap 1", HTML: "<p>hola</p>"}})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if saved.BookID != "book-id" || !saved.UpdatedAt.Equal(now) || len(saved.Chapters) != 1 {
		t.Fatalf("unexpected save result: %#v", saved)
	}
	if repository.saved.BookID != "book-id" {
		t.Fatalf("repository did not receive resolved book id: %#v", repository.saved)
	}
}

func TestSaveRejectsOversizedChapter(t *testing.T) {
	t.Parallel()
	service := NewService(&repositoryStub{}, booksStub{value: book.Book{ID: "book-id"}})
	huge := strings.Repeat("a", manuscript.MaxChapterBytes+1)
	if _, err := service.Save(context.Background(), "book-slug", []manuscript.Chapter{{ID: 1, HTML: huge}}); err == nil {
		t.Fatal("expected validation error for an oversized chapter")
	}
}
