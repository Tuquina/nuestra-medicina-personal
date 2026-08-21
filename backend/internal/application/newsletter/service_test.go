package newsletter

import (
	"context"
	"testing"
	"time"

	newsletterdomain "github.com/nuestra-medicina-personal/backend/internal/domain/newsletter"
)

type repositoryStub struct {
	byUserID map[string]newsletterdomain.Subscription
	byEmail  map[string]newsletterdomain.Subscription
	upserted newsletterdomain.Subscription
}

func newRepositoryStub() *repositoryStub {
	return &repositoryStub{byUserID: map[string]newsletterdomain.Subscription{}, byEmail: map[string]newsletterdomain.Subscription{}}
}

func (r *repositoryStub) Upsert(_ context.Context, value newsletterdomain.Subscription) (newsletterdomain.Subscription, error) {
	r.upserted = value
	r.byEmail[value.Email] = value
	if value.UserID != nil {
		r.byUserID[*value.UserID] = value
	}
	return value, nil
}

func (r *repositoryStub) GetByUserID(_ context.Context, userID string) (newsletterdomain.Subscription, error) {
	value, ok := r.byUserID[userID]
	if !ok {
		return newsletterdomain.Subscription{}, newsletterdomain.ErrNotFound
	}
	return value, nil
}

func TestSubscribeNormalizesEmailAndDefaultsSource(t *testing.T) {
	repository := newRepositoryStub()
	service := NewService(repository)
	now := time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	created, err := service.Subscribe(context.Background(), " READER@Example.com ", "")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	if created.Email != "reader@example.com" || created.Source != "UNKNOWN" {
		t.Fatalf("subscription was not normalized: %#v", created)
	}
	if created.Status != newsletterdomain.StatusSubscribed || created.SubscribedAt == nil || !created.SubscribedAt.Equal(now) {
		t.Fatalf("subscription was not marked subscribed: %#v", created)
	}
}

func TestSubscribeRejectsInvalidEmail(t *testing.T) {
	service := NewService(newRepositoryStub())
	if _, err := service.Subscribe(context.Background(), "not-an-email", "FOOTER"); err == nil {
		t.Fatal("expected validation error for invalid email")
	}
}

func TestSetPreferenceTiesSubscriptionToUser(t *testing.T) {
	repository := newRepositoryStub()
	service := NewService(repository)
	if _, err := service.SetPreference(context.Background(), "user-1", "reader@example.com", true); err != nil {
		t.Fatalf("set preference: %v", err)
	}
	if repository.upserted.UserID == nil || *repository.upserted.UserID != "user-1" {
		t.Fatalf("subscription was not tied to user: %#v", repository.upserted)
	}
}

func TestSetPreferenceFalseUnsubscribes(t *testing.T) {
	repository := newRepositoryStub()
	service := NewService(repository)
	if _, err := service.SetPreference(context.Background(), "user-1", "reader@example.com", false); err != nil {
		t.Fatalf("set preference: %v", err)
	}
	if repository.upserted.Status != newsletterdomain.StatusUnsubscribed {
		t.Fatalf("expected unsubscribed status, got %#v", repository.upserted)
	}
}

func TestGetPreferenceReturnsFalseWhenNoSubscriptionExists(t *testing.T) {
	service := NewService(newRepositoryStub())
	subscribed, err := service.GetPreference(context.Background(), "unknown-user")
	if err != nil {
		t.Fatalf("get preference: %v", err)
	}
	if subscribed {
		t.Fatal("expected false for a user with no subscription row")
	}
}

func TestGetPreferenceReflectsStoredStatus(t *testing.T) {
	repository := newRepositoryStub()
	userID := "user-1"
	repository.byUserID[userID] = newsletterdomain.Subscription{UserID: &userID, Status: newsletterdomain.StatusSubscribed}
	service := NewService(repository)
	subscribed, err := service.GetPreference(context.Background(), userID)
	if err != nil {
		t.Fatalf("get preference: %v", err)
	}
	if !subscribed {
		t.Fatal("expected true for a subscribed user")
	}
}

