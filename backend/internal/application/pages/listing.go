package pages

import (
	"context"
	"fmt"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

// ListRepository is implemented by postgres.PageRepository.
type ListRepository interface {
	ListByType(ctx context.Context, pageType string, publishedOnly bool) ([]page.Page, error)
}

// ListingService lists pages of the repeatable types (meditations) for the
// public site and the backoffice.
type ListingService struct {
	repository ListRepository
}

func NewListingService(repository ListRepository) *ListingService {
	return &ListingService{repository: repository}
}

// ListByType returns every page of a type, drafts included (backoffice).
func (s *ListingService) ListByType(ctx context.Context, pageType string) ([]page.Page, error) {
	if pageType != string(page.TypeMeditation) {
		return nil, &page.ValidationError{Fields: map[string]string{"type": "is not a listable page type"}}
	}
	return s.repository.ListByType(ctx, pageType, false)
}

// ListPublishedMeditations returns the cards of every published meditation,
// read from its published content (drafts never leak to the public list).
func (s *ListingService) ListPublishedMeditations(ctx context.Context) ([]page.MeditationSummary, error) {
	values, err := s.repository.ListByType(ctx, string(page.TypeMeditation), true)
	if err != nil {
		return nil, fmt.Errorf("list published meditations: %w", err)
	}
	summaries := make([]page.MeditationSummary, 0, len(values))
	for _, value := range values {
		if value.PublishedContent == nil {
			continue
		}
		if summary, ok := page.MeditationSummaryOf(value.Slug, *value.PublishedContent); ok {
			summaries = append(summaries, summary)
		}
	}
	return summaries, nil
}
