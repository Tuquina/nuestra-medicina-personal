package reviews

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/review"
)

type Repository interface {
	ListApproved(context.Context, string) ([]review.Review, error)
	ListAdmin(context.Context) ([]review.Review, error)
	CreateForPurchasedBook(context.Context, review.Review) (review.Review, error)
	SetStatus(context.Context, string, review.Status, time.Time) (review.Review, error)
	Delete(context.Context, string) error
}

type Service struct {
	repository Repository
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now, newID: randomUUID}
}
func (s *Service) ListApproved(ctx context.Context, slug string) ([]review.Review, error) {
	return s.repository.ListApproved(ctx, slug)
}
func (s *Service) ListAdmin(ctx context.Context) ([]review.Review, error) {
	return s.repository.ListAdmin(ctx)
}
func (s *Service) Create(ctx context.Context, userID, bookSlug string, value review.Review) (review.Review, error) {
	value.Normalize()
	if err := value.Validate(); err != nil {
		return review.Review{}, err
	}
	id, err := s.newID()
	if err != nil {
		return review.Review{}, fmt.Errorf("generate review id: %w", err)
	}
	now := s.now().UTC()
	value.ID, value.UserID, value.BookSlug, value.Status, value.CreatedAt, value.UpdatedAt = id, userID, bookSlug, review.StatusPending, now, now
	return s.repository.CreateForPurchasedBook(ctx, value)
}
func (s *Service) SetStatus(ctx context.Context, id string, status review.Status) (review.Review, error) {
	if status != review.StatusApproved && status != review.StatusRejected {
		return review.Review{}, &review.ValidationError{Fields: map[string]string{"status": "must be APPROVED or REJECTED"}}
	}
	return s.repository.SetStatus(ctx, id, status, s.now().UTC())
}
func (s *Service) Delete(ctx context.Context, id string) error { return s.repository.Delete(ctx, id) }

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
