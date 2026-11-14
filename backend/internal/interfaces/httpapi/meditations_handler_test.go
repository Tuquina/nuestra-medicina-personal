package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

type pageListingStub struct{ listedType string }

func (s *pageListingStub) ListByType(_ context.Context, pageType string) ([]page.Page, error) {
	s.listedType = pageType
	if pageType != string(page.TypeMeditation) {
		return nil, &page.ValidationError{Fields: map[string]string{"type": "is not a listable page type"}}
	}
	return []page.Page{{
		ID: "70000000-0000-4000-8000-000000000101", Type: pageType, Slug: "respirar-y-empezar", Title: "Respirar y empezar",
		Status: page.StatusDraft, DraftContent: page.EmptyContent(), UpdatedAt: time.Now(),
	}}, nil
}

func (s *pageListingStub) ListPublishedMeditations(context.Context) ([]page.MeditationSummary, error) {
	minutes := 10
	return []page.MeditationSummary{{Slug: "respirar-y-empezar", Title: "Respirar y empezar", Description: "Breve", DurationMinutes: &minutes, HasVideo: true}}, nil
}

func meditationsRouter(listing PageListingService, authorizer AdminAuthorizer) http.Handler {
	return NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizer,
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session", PageListing: listing,
	})
}

func TestPublicMeditationListIsOpenAndSummarized(t *testing.T) {
	t.Parallel()
	recorder := httptest.NewRecorder()
	meditationsRouter(&pageListingStub{}, authorizerStub{}).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/meditations", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var body struct {
		Items []struct {
			Slug            string `json:"slug"`
			DurationMinutes int    `json:"durationMinutes"`
			HasVideo        bool   `json:"hasVideo"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].Slug != "respirar-y-empezar" || body.Items[0].DurationMinutes != 10 || !body.Items[0].HasVideo {
		t.Fatalf("unexpected body %s", recorder.Body.String())
	}
}

func TestAdminPageListingRequiresAdminAndAType(t *testing.T) {
	t.Parallel()
	listing := &pageListingStub{}
	router := meditationsRouter(listing, authorizerStub{})

	unauthenticated := httptest.NewRecorder()
	router.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodGet, "/api/v1/admin/pages?type=MEDITACION", nil))
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a session, got %d", unauthenticated.Code)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/pages?type=MEDITACION", nil)
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || listing.listedType != "MEDITACION" || !strings.Contains(recorder.Body.String(), `"hasUnpublishedChanges":true`) {
		t.Fatalf("unexpected admin listing %d %s", recorder.Code, recorder.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/pages?type=HOME", nil)
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for a singleton type, got %d", recorder.Code)
	}
}
