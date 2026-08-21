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

// Import converts an uploaded file into chapters (see Import in
// importer.go) and persists them immediately — same effect as opening the
// editor and clicking save, not just a preview held in the browser.
func (s *Service) Import(ctx context.Context, identifier, filename string, content []byte) (manuscript.Manuscript, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	chapters, err := Import(filename, content)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	candidate := manuscript.Manuscript{BookID: selectedBook.ID, Chapters: chapters, UpdatedAt: s.now().UTC()}
	if err := candidate.Validate(); err != nil {
		return manuscript.Manuscript{}, err
	}
	return s.repository.Save(ctx, candidate)
}

// Export renders the currently-saved chapters as a downloadable file.
// Nothing is written to storage here — the caller streams the bytes back
// to the browser; per ADR 0004 a generated file never auto-replaces the
// book's purchasable ebook.
func (s *Service) Export(ctx context.Context, identifier, format string) ([]byte, string, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return nil, "", err
	}
	saved, err := s.repository.Get(ctx, selectedBook.ID)
	if errors.Is(err, manuscript.ErrNotFound) {
		saved = manuscript.Manuscript{Chapters: []manuscript.Chapter{}}
	} else if err != nil {
		return nil, "", fmt.Errorf("get manuscript for export: %w", err)
	}
	switch format {
	case "epub":
		data, err := ExportEPUB(selectedBook.Title, selectedBook.AuthorName, saved.Chapters)
		if err != nil {
			return nil, "", err
		}
		return data, selectedBook.Slug + ".epub", nil
	case "pdf":
		data, err := ExportPDF(selectedBook.Title, selectedBook.AuthorName, saved.Chapters)
		if err != nil {
			return nil, "", err
		}
		return data, selectedBook.Slug + ".pdf", nil
	default:
		return nil, "", manuscript.ErrUnsupportedFormat
	}
}
