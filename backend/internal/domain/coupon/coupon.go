package coupon

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

type Kind string

const (
	KindPercentage Kind = "PERCENTAGE"
	KindFixed      Kind = "FIXED"
)

var (
	ErrNotFound     = errors.New("coupon not found")
	ErrCodeConflict = errors.New("coupon code already exists")
	codePattern     = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]*$`)
)

type Coupon struct {
	ID           string
	Code         string
	Kind         Kind
	Value        int64
	Currency     string
	StartsAt     time.Time
	EndsAt       time.Time
	UsageLimit   *int
	UsageCount   int
	AppliesToAll bool
	BookIDs      []string
	Active       bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type ValidationError struct{ Fields map[string]string }

func (e *ValidationError) Error() string { return "coupon validation failed" }

func (c *Coupon) Normalize() {
	c.Code = strings.ToUpper(strings.TrimSpace(c.Code))
	c.Currency = strings.ToUpper(strings.TrimSpace(c.Currency))
	if c.Currency == "" {
		c.Currency = "ARS"
	}
	if c.AppliesToAll {
		c.BookIDs = nil
	}
}

func (c Coupon) Validate() error {
	fields := make(map[string]string)
	if !codePattern.MatchString(c.Code) || len(c.Code) > 80 {
		fields["code"] = "must contain 1 to 80 uppercase letters, numbers, hyphens or underscores"
	}
	if c.Kind != KindPercentage && c.Kind != KindFixed {
		fields["kind"] = "must be PERCENTAGE or FIXED"
	}
	if c.Value <= 0 || (c.Kind == KindPercentage && c.Value > 100) {
		fields["value"] = "must be positive and at most 100 for a percentage"
	}
	if len(c.Currency) != 3 {
		fields["currency"] = "must be a three-letter currency code"
	}
	if c.StartsAt.IsZero() || c.EndsAt.IsZero() || c.EndsAt.Before(c.StartsAt) {
		fields["endsAt"] = "must be on or after startsAt"
	}
	if c.UsageLimit != nil && *c.UsageLimit <= 0 {
		fields["usageLimit"] = "must be greater than zero"
	}
	if !c.AppliesToAll && len(c.BookIDs) == 0 {
		fields["bookIds"] = "must include at least one book"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

func (c Coupon) EffectiveStatus(today time.Time) string {
	if !c.Active {
		return "INACTIVE"
	}
	today = dateOnly(today)
	if today.Before(dateOnly(c.StartsAt)) {
		return "SCHEDULED"
	}
	if today.After(dateOnly(c.EndsAt)) || (c.UsageLimit != nil && c.UsageCount >= *c.UsageLimit) {
		return "EXPIRED"
	}
	return "ACTIVE"
}

func dateOnly(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}
