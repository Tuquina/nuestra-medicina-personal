package manuscripts

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type Repository interface {
	Get(context.Context, string) (manuscript.Manuscript, error)
	Save(context.Context, manuscript.Manuscript) (manuscript.Manuscript, error)
}

type Service struct {
	repository Repository
	books      interface {
		Get(context.Context, string) (book.Book, error)
	}
	now func() time.Time
}

func NewService(repository Repository, books interface {
	Get(context.Context, string) (book.Book, error)
}) *Service {
	return &Service{repository: repository, books: books, now: time.Now}
}

// Get resolves identifier (slug or UUID, like the admin book routes) to a
// book, then its manuscript. A book with no saved manuscript yet is not an
// error — it just means "not started", same as a brand new book.
func (s *Service) Get(ctx context.Context, identifier string) (manuscript.Manuscript, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	value, err := s.repository.Get(ctx, selectedBook.ID)
	if errors.Is(err, manuscript.ErrNotFound) {
		return manuscript.Manuscript{BookID: selectedBook.ID, Chapters: []manuscript.Chapter{}}, nil
	}
	if err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("get manuscript: %w", err)
	}
	return value, nil
}

func (s *Service) Save(ctx context.Context, identifier string, chapters []manuscript.Chapter) (manuscript.Manuscript, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	if chapters == nil {
		chapters = []manuscript.Chapter{}
	}
	candidate := manuscript.Manuscript{BookID: selectedBook.ID, Chapters: chapters, UpdatedAt: s.now().UTC()}
	if err := candidate.Validate(); err != nil {
		return manuscript.Manuscript{}, err
	}
	return s.repository.Save(ctx, candidate)
}
