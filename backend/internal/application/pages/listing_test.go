package pages

import (
	"context"
	"errors"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type listRepositoryStub struct {
	pages         []page.Page
	publishedOnly bool
}

func (s *listRepositoryStub) ListByType(_ context.Context, _ string, publishedOnly bool) ([]page.Page, error) {
	s.publishedOnly = publishedOnly
	return s.pages, nil
}

func meditationPage(t *testing.T, slug, title string) page.Page {
	t.Helper()
	content, err := page.DecodeContent([]byte(`{"schemaVersion":1,"sections":[{"id":"meditation","type":"meditation","props":{"title":"` + title + `","description":"Desc","imageId":null,"imageAlt":"","video":null,"durationMinutes":5,"guidance":""}}]}`))
	if err != nil {
		t.Fatal(err)
	}
	return page.Page{Type: string(page.TypeMeditation), Slug: slug, Title: title, DraftContent: content, PublishedContent: &content}
}

func TestListPublishedMeditationsReadsPublishedContentOnly(t *testing.T) {
	published := meditationPage(t, "respirar", "Respirar")
	draftOnly := meditationPage(t, "borrador", "Borrador")
	draftOnly.PublishedContent = nil
	repository := &listRepositoryStub{pages: []page.Page{published, draftOnly}}

	summaries, err := NewListingService(repository).ListPublishedMeditations(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !repository.publishedOnly {
		t.Fatal("the public list must ask the repository for published pages only")
	}
	if len(summaries) != 1 || summaries[0].Slug != "respirar" || summaries[0].Title != "Respirar" {
		t.Fatalf("unexpected summaries %+v", summaries)
	}
}

func TestListByTypeOnlyAllowsRepeatablePageTypes(t *testing.T) {
	repository := &listRepositoryStub{}
	service := NewListingService(repository)
	if _, err := service.ListByType(context.Background(), string(page.TypeMeditation)); err != nil || repository.publishedOnly {
		t.Fatalf("expected drafts to be included for the backoffice, err=%v", err)
	}
	var validation *page.ValidationError
	if _, err := service.ListByType(context.Background(), "HOME"); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for a singleton type, got %v", err)
	}
}
