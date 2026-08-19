package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

type bookServiceStub struct{}

func (bookServiceStub) ListPublished(context.Context) ([]book.Book, error) { return []book.Book{}, nil }
func (bookServiceStub) GetPublishedBySlug(context.Context, string) (book.Book, error) {
	return book.Book{}, book.ErrNotFound
}
func (bookServiceStub) ListAll(context.Context) ([]book.Book, error) { return []book.Book{}, nil }
func (bookServiceStub) Get(context.Context, string) (book.Book, error) {
	return book.Book{}, book.ErrNotFound
}
func (bookServiceStub) Create(context.Context, book.Book) (book.Book, error) {
	return book.Book{}, nil
}
func (bookServiceStub) Update(context.Context, string, book.Book) (book.Book, error) {
	return book.Book{}, nil
}
func (bookServiceStub) Archive(context.Context, string) error { return nil }

type healthStub struct{ err error }

func (h healthStub) Ping(context.Context) error { return h.err }

type authorizerStub struct{ err error }

func (a authorizerStub) AuthorizeAdmin(context.Context, string) (string, error) {
	return "user-1", a.err
}

func testRouter(authorizer AdminAuthorizer) http.Handler {
	return NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Database: healthStub{}, AdminAuthorizer: authorizer,
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
}

func TestAdminRoutesRequireSessionAndAdmin(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		authorizer AdminAuthorizer
		cookie     bool
		wantStatus int
	}{
		{name: "missing session", authorizer: authorizerStub{}, wantStatus: http.StatusUnauthorized},
		{name: "non-admin session", authorizer: authorizerStub{err: auth.ErrUnauthorized}, cookie: true, wantStatus: http.StatusForbidden},
		{name: "admin session", authorizer: authorizerStub{}, cookie: true, wantStatus: http.StatusOK},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/books", nil)
			if test.cookie {
				request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
			}
			testRouter(test.authorizer).ServeHTTP(recorder, request)
			if recorder.Code != test.wantStatus {
				t.Fatalf("expected %d, got %d: %s", test.wantStatus, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestAdminWritesRequireSameOrigin(t *testing.T) {
	t.Parallel()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/books", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://attacker.example")
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	testRouter(authorizerStub{}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected %d, got %d", http.StatusForbidden, recorder.Code)
	}
}

func TestHealthReadyReflectsDatabase(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Database: healthStub{err: errors.New("down")}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
}

func TestPublicBookResponseNeverIncludesFilePath(t *testing.T) {
	t.Parallel()
	response := mapBook(book.Book{ID: "book-id", EbookFilePath: stringPointer("/data/ebooks/secret.epub"), CreatedAt: time.Now(), UpdatedAt: time.Now()})
	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	if strings.Contains(string(payload), "ebookFilePath") || strings.Contains(string(payload), "/data/ebooks") {
		t.Fatalf("response exposes ebook file path: %s", payload)
	}
	if response.ID != "book-id" {
		t.Fatal("unexpected mapping")
	}
}

func stringPointer(value string) *string { return &value }
