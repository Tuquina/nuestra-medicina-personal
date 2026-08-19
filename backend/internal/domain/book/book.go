package book

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

type Status string

const (
	StatusDraft     Status = "DRAFT"
	StatusPublished Status = "PUBLISHED"
	StatusArchived  Status = "ARCHIVED"
)

var (
	ErrNotFound     = errors.New("book not found")
	ErrSlugConflict = errors.New("book slug already exists")
	slugPattern     = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
)

type Book struct {
	ID                   string
	Slug                 string
	Title                string
	Subtitle             string
	AuthorName           string
	Category             string
	Variant              string
	ShortDescription     string
	PriceMinorUnits      int64
	Currency             string
	ISBN                 string
	PublicationDate      *time.Time
	PublicationDateLabel string
	Format               string
	FileSizeBytes        *int64
	CoverMediaID         *string
	CoverCaption         string
	EbookFilePath        *string
	Status               Status
	SEOTitle             string
	SEODescription       string
	SEOIndexable         bool
	CreatedAt            time.Time
	UpdatedAt            time.Time
	PublishedAt          *time.Time
}

func (b *Book) ApplyDefaults() {
	b.Slug = strings.TrimSpace(b.Slug)
	b.Title = strings.TrimSpace(b.Title)
	b.Subtitle = strings.TrimSpace(b.Subtitle)
	b.AuthorName = strings.TrimSpace(b.AuthorName)
	b.Category = strings.TrimSpace(b.Category)
	b.Variant = strings.TrimSpace(b.Variant)
	b.ShortDescription = strings.TrimSpace(b.ShortDescription)
	b.Currency = strings.ToUpper(strings.TrimSpace(b.Currency))
	b.ISBN = strings.TrimSpace(b.ISBN)
	b.PublicationDateLabel = strings.TrimSpace(b.PublicationDateLabel)
	b.Format = strings.TrimSpace(b.Format)
	b.CoverCaption = strings.TrimSpace(b.CoverCaption)
	b.SEOTitle = strings.TrimSpace(b.SEOTitle)
	b.SEODescription = strings.TrimSpace(b.SEODescription)

	if b.Currency == "" {
		b.Currency = "ARS"
	}
	if b.Status == "" {
		b.Status = StatusDraft
	}
	if b.Variant == "" {
		b.Variant = "blue"
	}
}

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "book validation failed" }

func (b Book) Validate() error {
	fields := make(map[string]string)
	if b.Title == "" {
		fields["title"] = "is required"
	} else if len(b.Title) > 200 {
		fields["title"] = "must be at most 200 characters"
	}
	if !slugPattern.MatchString(b.Slug) || len(b.Slug) > 160 {
		fields["slug"] = "must contain lowercase letters, numbers and single hyphens only"
	}
	if len(b.Currency) != 3 {
		fields["currency"] = "must be a three-letter currency code"
	}
	if b.PriceMinorUnits < 0 {
		fields["priceMinorUnits"] = "must be zero or greater"
	}
	if b.Status != StatusDraft && b.Status != StatusPublished && b.Status != StatusArchived {
		fields["status"] = "must be DRAFT, PUBLISHED or ARCHIVED"
	}
	if b.Status == StatusPublished && b.PriceMinorUnits <= 0 {
		fields["priceMinorUnits"] = "must be greater than zero for a published book"
	}
	if b.Variant != "gold" && b.Variant != "blue" {
		fields["variant"] = "must be gold or blue"
	}
	if len(b.ShortDescription) > 1000 {
		fields["shortDescription"] = "must be at most 1000 characters"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}
