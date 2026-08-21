package newsletter

import (
	"errors"
	"net/mail"
	"strings"
	"time"
)

type Status string

const (
	StatusSubscribed   Status = "SUBSCRIBED"
	StatusUnsubscribed Status = "UNSUBSCRIBED"
)

var ErrNotFound = errors.New("subscription not found")

type Subscription struct {
	ID             string
	UserID         *string
	Email          string
	Status         Status
	Source         string
	SubscribedAt   *time.Time
	UnsubscribedAt *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type ValidationError struct{ Fields map[string]string }

func (e *ValidationError) Error() string { return "subscription is invalid" }

func (s *Subscription) Normalize() {
	s.Email = strings.ToLower(strings.TrimSpace(s.Email))
	s.Source = strings.TrimSpace(s.Source)
	if s.Source == "" {
		s.Source = "UNKNOWN"
	}
}

func (s Subscription) Validate() error {
	fields := make(map[string]string)
	address, err := mail.ParseAddress(s.Email)
	if err != nil || address.Address != s.Email || len(s.Email) > 320 {
		fields["email"] = "must be a valid email address"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}
