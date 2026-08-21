package newsletter

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/newsletter"
)

type Repository interface {
	// Upsert creates or updates the subscription for value.Email, always
	// setting Status/SubscribedAt/UnsubscribedAt from value. When
	// value.UserID is set, it's attached to the row so a later account-page
	// lookup finds it even if the person first subscribed anonymously.
	Upsert(context.Context, newsletter.Subscription) (newsletter.Subscription, error)
	GetByUserID(context.Context, string) (newsletter.Subscription, error)
}

type Service struct {
	repository Repository
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now, newID: randomUUID}
}

// Subscribe is the public signup form's entry point — idempotent by email,
// no authentication required.
func (s *Service) Subscribe(ctx context.Context, email, source string) (newsletter.Subscription, error) {
	return s.upsert(ctx, nil, email, source, true)
}

// SetPreference is the Mi Cuenta switch's entry point — always tied to the
// signed-in user's own email.
func (s *Service) SetPreference(ctx context.Context, userID, email string, subscribed bool) (newsletter.Subscription, error) {
	return s.upsert(ctx, &userID, email, "ACCOUNT", subscribed)
}

// GetPreference reports whether the signed-in user currently has an active
// subscription. No row yet is not an error — it just means "not subscribed".
func (s *Service) GetPreference(ctx context.Context, userID string) (bool, error) {
	value, err := s.repository.GetByUserID(ctx, userID)
	if errors.Is(err, newsletter.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("get newsletter preference: %w", err)
	}
	return value.Status == newsletter.StatusSubscribed, nil
}

func (s *Service) upsert(ctx context.Context, userID *string, email, source string, subscribed bool) (newsletter.Subscription, error) {
	value := newsletter.Subscription{Email: email, Source: source, UserID: userID}
	value.Normalize()
	if err := value.Validate(); err != nil {
		return newsletter.Subscription{}, err
	}
	id, err := s.newID()
	if err != nil {
		return newsletter.Subscription{}, fmt.Errorf("generate subscription id: %w", err)
	}
	now := s.now().UTC()
	value.ID, value.CreatedAt, value.UpdatedAt = id, now, now
	if subscribed {
		value.Status, value.SubscribedAt, value.UnsubscribedAt = newsletter.StatusSubscribed, &now, nil
	} else {
		value.Status, value.UnsubscribedAt = newsletter.StatusUnsubscribed, &now
	}
	return s.repository.Upsert(ctx, value)
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
