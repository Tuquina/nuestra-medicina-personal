package review

import (
	"errors"
	"strings"
	"time"
)

type Status string

const (
	StatusPending  Status = "PENDING"
	StatusApproved Status = "APPROVED"
	StatusRejected Status = "REJECTED"
)

var (
	ErrNotFound         = errors.New("review not found")
	ErrAlreadyExists    = errors.New("review already exists")
	ErrPurchaseRequired = errors.New("paid purchase required")
)

type Review struct {
	ID           string
	BookID       string
	BookSlug     string
	BookTitle    string
	UserID       string
	CustomerName string
	Rating       int
	Body         string
	Status       Status
	CreatedAt    time.Time
	UpdatedAt    time.Time
	ModeratedAt  *time.Time
}

type ValidationError struct{ Fields map[string]string }

func (e *ValidationError) Error() string { return "review validation failed" }

func (r *Review) Normalize() { r.Body = strings.TrimSpace(r.Body) }

func (r Review) Validate() error {
	fields := make(map[string]string)
	if r.Rating < 1 || r.Rating > 5 {
		fields["rating"] = "must be between 1 and 5"
	}
	if length := len([]rune(r.Body)); length < 1 || length > 4000 {
		fields["body"] = "must contain between 1 and 4000 characters"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}
