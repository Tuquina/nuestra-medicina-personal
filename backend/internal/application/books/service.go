package books

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

type Repository interface {
	ListPublished(context.Context) ([]book.Book, error)
	GetPublishedBySlug(context.Context, string) (book.Book, error)
	ListAll(context.Context) ([]book.Book, error)
	GetByIdentifier(context.Context, string) (book.Book, error)
	Create(context.Context, book.Book) (book.Book, error)
	Update(context.Context, book.Book) (book.Book, error)
	Archive(context.Context, string, time.Time) error
}

type Service struct {
	repository Repository
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now, newID: randomUUID}
}

func (s *Service) ListPublished(ctx context.Context) ([]book.Book, error) {
	return s.repository.ListPublished(ctx)
}

func (s *Service) GetPublishedBySlug(ctx context.Context, slug string) (book.Book, error) {
	return s.repository.GetPublishedBySlug(ctx, slug)
}

func (s *Service) ListAll(ctx context.Context) ([]book.Book, error) {
	return s.repository.ListAll(ctx)
}

func (s *Service) Get(ctx context.Context, identifier string) (book.Book, error) {
	return s.repository.GetByIdentifier(ctx, identifier)
}

func (s *Service) Create(ctx context.Context, candidate book.Book) (book.Book, error) {
	candidate.ApplyDefaults()
	if err := candidate.Validate(); err != nil {
		return book.Book{}, err
	}
	id, err := s.newID()
	if err != nil {
		return book.Book{}, fmt.Errorf("generate book id: %w", err)
	}
	now := s.now().UTC()
	candidate.ID = id
	candidate.CreatedAt = now
	candidate.UpdatedAt = now
	if candidate.Status == book.StatusPublished {
		candidate.PublishedAt = &now
	}
	return s.repository.Create(ctx, candidate)
}

func (s *Service) Update(ctx context.Context, identifier string, candidate book.Book) (book.Book, error) {
	existing, err := s.repository.GetByIdentifier(ctx, identifier)
	if err != nil {
		return book.Book{}, err
	}
	candidate.ApplyDefaults()
	if err := candidate.Validate(); err != nil {
		return book.Book{}, err
	}
	candidate.ID = existing.ID
	candidate.CreatedAt = existing.CreatedAt
	candidate.EbookFilePath = existing.EbookFilePath
	candidate.UpdatedAt = s.now().UTC()
	candidate.PublishedAt = existing.PublishedAt
	if candidate.Status == book.StatusPublished && existing.Status != book.StatusPublished {
		publishedAt := candidate.UpdatedAt
		candidate.PublishedAt = &publishedAt
	}
	return s.repository.Update(ctx, candidate)
}

func (s *Service) Archive(ctx context.Context, identifier string) error {
	return s.repository.Archive(ctx, identifier, s.now().UTC())
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
