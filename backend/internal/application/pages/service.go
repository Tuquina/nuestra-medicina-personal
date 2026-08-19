package pages

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type Repository interface {
	Create(context.Context, page.Page) (page.Page, error)
	Get(context.Context, string) (page.Page, error)
	GetPublished(context.Context, string) (page.Page, error)
	SaveDraft(context.Context, string, page.Content, time.Time) (page.Page, error)
	Publish(context.Context, string, string, string, time.Time) (page.Page, error)
	ListVersions(context.Context, string) ([]page.Version, error)
	Restore(context.Context, string, string, time.Time) (page.Page, error)
}

type Service struct {
	repository Repository
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now, newID: randomUUID}
}

func (s *Service) Create(ctx context.Context, candidate page.Page) (page.Page, error) {
	if candidate.DraftContent.Sections == nil && candidate.DraftContent.SchemaVersion == 0 {
		candidate.DraftContent = page.EmptyContent()
	}
	if err := candidate.Validate(); err != nil {
		return page.Page{}, err
	}
	id, err := s.newID()
	if err != nil {
		return page.Page{}, fmt.Errorf("generate page id: %w", err)
	}
	now := s.now().UTC()
	candidate.ID = id
	candidate.Status = page.StatusDraft
	candidate.CreatedAt = now
	candidate.UpdatedAt = now
	return s.repository.Create(ctx, candidate)
}

func (s *Service) Get(ctx context.Context, identifier string) (page.Page, error) {
	return s.repository.Get(ctx, identifier)
}

func (s *Service) GetPublished(ctx context.Context, slug string) (page.Page, error) {
	return s.repository.GetPublished(ctx, slug)
}

func (s *Service) SaveDraft(ctx context.Context, identifier string, content page.Content) (page.Page, error) {
	if err := content.Validate(); err != nil {
		return page.Page{}, err
	}
	return s.repository.SaveDraft(ctx, identifier, content, s.now().UTC())
}

func (s *Service) Publish(ctx context.Context, identifier, actorID string) (page.Page, error) {
	versionID, err := s.newID()
	if err != nil {
		return page.Page{}, fmt.Errorf("generate page version id: %w", err)
	}
	return s.repository.Publish(ctx, identifier, versionID, actorID, s.now().UTC())
}

func (s *Service) ListVersions(ctx context.Context, identifier string) ([]page.Version, error) {
	return s.repository.ListVersions(ctx, identifier)
}

func (s *Service) Restore(ctx context.Context, identifier, versionID string) (page.Page, error) {
	return s.repository.Restore(ctx, identifier, versionID, s.now().UTC())
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
