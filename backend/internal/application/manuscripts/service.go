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
		return manuscript.Manuscript{
			BookID:   selectedBook.ID,
			Chapters: []manuscript.Chapter{},
			PageSize: manuscript.DefaultPageSizeID,
		}, nil
	}
	if err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("get manuscript: %w", err)
	}
	return value, nil
}

func (s *Service) Save(ctx context.Context, identifier string, chapters []manuscript.Chapter, pageSize string) (manuscript.Manuscript, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	if chapters == nil {
		chapters = []manuscript.Chapter{}
	}
	candidate := manuscript.Manuscript{
		BookID: selectedBook.ID,
		// An unknown/empty page size resolves to the default rather than
		// being rejected — the field is a rendering preference, not data
		// worth failing an autosave over.
		Chapters:  chapters,
		PageSize:  manuscript.FindPageSize(pageSize).ID,
		UpdatedAt: s.now().UTC(),
	}
	if err := candidate.Validate(); err != nil {
		return manuscript.Manuscript{}, err
	}
	return s.repository.Save(ctx, candidate)
}

// Import converts an uploaded file into chapters (see Import in
// importer.go) and persists them immediately — same effect as opening the
// editor and clicking save, not just a preview held in the browser.
//
// When append is true the imported sections are added after whatever the
// book already has, so importing a second chapter into a manuscript in
// progress no longer silently destroys the work already in it; the
// existing page size is preserved either way.
func (s *Service) Import(ctx context.Context, identifier, filename string, content []byte, appendToExisting bool) (manuscript.Manuscript, error) {
	selectedBook, err := s.books.Get(ctx, identifier)
	if err != nil {
		return manuscript.Manuscript{}, err
	}
	imported, err := Import(filename, content)
	if err != nil {
		return manuscript.Manuscript{}, err
	}

	existing, err := s.repository.Get(ctx, selectedBook.ID)
	if err != nil && !errors.Is(err, manuscript.ErrNotFound) {
		return manuscript.Manuscript{}, fmt.Errorf("get manuscript for import: %w", err)
	}

	chapters := imported
	if appendToExisting && len(existing.Chapters) > 0 {
		nextID := 0
		for _, chapter := range existing.Chapters {
			nextID = max(nextID, chapter.ID)
		}
		chapters = append([]manuscript.Chapter{}, existing.Chapters...)
		for _, chapter := range imported {
			nextID++
			chapter.ID = nextID
			chapters = append(chapters, chapter)
		}
	}
	if len(chapters) > manuscript.MaxChapters {
		chapters = chapters[:manuscript.MaxChapters]
	}

	pageSize := existing.PageSize
	if pageSize == "" {
		pageSize = manuscript.DefaultPageSizeID
	}
	candidate := manuscript.Manuscript{
		BookID:    selectedBook.ID,
		Chapters:  chapters,
		PageSize:  pageSize,
		UpdatedAt: s.now().UTC(),
	}
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
		data, err := ExportPDF(selectedBook.Title, selectedBook.AuthorName, saved.Chapters, saved.PageSize)
		if err != nil {
			return nil, "", err
		}
		return data, selectedBook.Slug + ".pdf", nil
	default:
		return nil, "", manuscript.ErrUnsupportedFormat
	}
}
