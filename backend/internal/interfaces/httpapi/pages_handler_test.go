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

type pageServiceStub struct {
	value        page.Page
	publishActor string
}

func (stub *pageServiceStub) Create(context.Context, page.Page) (page.Page, error) {
	return stub.value, nil
}
func (stub *pageServiceStub) Get(context.Context, string) (page.Page, error) { return stub.value, nil }
func (stub *pageServiceStub) GetPublished(context.Context, string) (page.Page, error) {
	return stub.value, nil
}
func (stub *pageServiceStub) SaveDraft(context.Context, string, page.Content) (page.Page, error) {
	return stub.value, nil
}
func (stub *pageServiceStub) Publish(_ context.Context, _ string, actorID string) (page.Page, error) {
	stub.publishActor = actorID
	return stub.value, nil
}
func (*pageServiceStub) ListVersions(context.Context, string) ([]page.Version, error) {
	return []page.Version{}, nil
}
func (stub *pageServiceStub) Restore(context.Context, string, string) (page.Page, error) {
	return stub.value, nil
}

func TestPublicPageOnlyReturnsPublishedContent(t *testing.T) {
	t.Parallel()
	published := page.Content{SchemaVersion: 1, Sections: []page.Block{}}
	stub := &pageServiceStub{value: page.Page{
		ID: "page-id", Type: "HOME", Slug: "home", Title: "Inicio",
		DraftContent:     page.Content{SchemaVersion: 1, Sections: []page.Block{{ID: "secret-draft"}}},
		PublishedContent: &published,
	}}
	router := pageTestRouter(stub)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/pages/home", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected published page, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "draftContent") || strings.Contains(recorder.Body.String(), "secret-draft") {
		t.Fatalf("public response leaked draft: %s", recorder.Body.String())
	}
	var response publishedPageResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || response.Content.SchemaVersion != 1 {
		t.Fatalf("decode public page: %#v %v", response, err)
	}
}

func TestPublishingPageUsesAuthorizedAdministrator(t *testing.T) {
	t.Parallel()
	published := page.EmptyContent()
	stub := &pageServiceStub{value: page.Page{
		ID: "page-id", Type: "HOME", Slug: "home", Title: "Inicio",
		Status: page.StatusPublished, DraftContent: published, PublishedContent: &published,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}}
	router := pageTestRouter(stub)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/pages/home/publish", nil)
	request.Header.Set("Origin", "http://localhost:5173")
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected publication, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if stub.publishActor != "user-1" {
		t.Fatalf("expected authorized actor, got %q", stub.publishActor)
	}
}

func pageTestRouter(service PageService) http.Handler {
	return NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Library: libraryServiceStub{}, Pages: service,
		Database: healthStub{}, AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173",
		SessionCookie: "nmp_session", EbookInternalPrefix: "/_protected/ebooks", EbookMaxUploadBytes: 50 << 20,
	})
}
