package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/application/authentication"
	libraryapp "github.com/nuestra-medicina-personal/backend/internal/application/library"
	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
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

type libraryServiceStub struct {
	download librarydomain.Download
	err      error
}

func (s libraryServiceStub) List(context.Context, string) ([]librarydomain.Book, error) {
	return []librarydomain.Book{}, s.err
}
func (s libraryServiceStub) Download(context.Context, string, string) (librarydomain.Download, error) {
	return s.download, s.err
}
func (s libraryServiceStub) Upload(context.Context, string, string, string, libraryapp.UploadFile) (librarydomain.StoredEbook, error) {
	return librarydomain.StoredEbook{}, s.err
}

type authServiceStub struct {
	logoutToken string
}

func (*authServiceStub) Start() (authentication.Flow, error) {
	return authentication.Flow{
		State: "state", Nonce: "nonce", Verifier: "verifier",
		AuthorizationURL: "https://accounts.google.com/o/oauth2/v2/auth?state=state",
	}, nil
}
func (*authServiceStub) Complete(context.Context, string, string, string, string, string) (auth.User, auth.Session, error) {
	return auth.User{}, auth.Session{Token: "session", ExpiresAt: time.Now().Add(time.Hour)}, nil
}
func (*authServiceStub) CurrentUser(context.Context, string) (auth.User, error) {
	return auth.User{ID: "user-1"}, nil
}
func (s *authServiceStub) Logout(_ context.Context, token string) error {
	s.logoutToken = token
	return nil
}
func (*authServiceStub) DeleteAccount(context.Context, string) error { return nil }
func (*authServiceStub) FlowTTL() time.Duration                      { return 10 * time.Minute }

func testRouter(authorizer AdminAuthorizer) http.Handler {
	return NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizer,
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		Library: libraryServiceStub{}, EbookInternalPrefix: "/_protected/ebooks", EbookMaxUploadBytes: 50 << 20,
	})
}

func TestProtectedDownloadUsesInternalNginxRedirect(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Library: libraryServiceStub{download: librarydomain.Download{
			StorageKey: "opaque-id.epub", Filename: "Mi libro.epub", MediaType: "application/epub+zip",
		}}, Database: healthStub{}, AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173",
		SessionCookie: "nmp_session", EbookInternalPrefix: "/_protected/ebooks", EbookMaxUploadBytes: 50 << 20,
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/books/20000000-0000-4000-8000-000000000001/download", nil)
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected download authorization, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("X-Accel-Redirect") != "/_protected/ebooks/opaque-id.epub" {
		t.Fatalf("unexpected internal redirect: %q", recorder.Header().Get("X-Accel-Redirect"))
	}
	if strings.Contains(recorder.Body.String(), "opaque-id") {
		t.Fatal("storage key leaked in response body")
	}
}

func TestProtectedDownloadHidesUnauthorizedBook(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Library: libraryServiceStub{err: librarydomain.ErrBookNotAvailable},
		Database: healthStub{}, AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173",
		SessionCookie: "nmp_session", EbookInternalPrefix: "/_protected/ebooks", EbookMaxUploadBytes: 50 << 20,
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/books/not-owned/download", nil)
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected hidden download, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminEbookUploadAcceptsMultipartAfterAuthorization(t *testing.T) {
	t.Parallel()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "book.pdf")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("%PDF-1.7\ncontent"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/books/book-id/ebook", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Origin", "http://localhost:5173")
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	testRouter(authorizerStub{}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected multipart upload to reach handler, got %d: %s", recorder.Code, recorder.Body.String())
	}
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

// TestLocalDebugAuthBypassesSessionEverywhere is the direct check for the
// local-debug admin bypass: with it armed, every session-gated route (not
// only /api/v1/admin/*) must succeed with *no* cookie at all — that's the
// whole point, opening the admin panel without a live Google OAuth login —
// and /api/v1/me must report an administrator, since that's what the
// frontend's own route guards act on before ever issuing a request behind
// requireAdmin/requireUser.
func TestLocalDebugAuthBypassesSessionEverywhere(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{err: auth.ErrUnauthorized},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		Library: libraryServiceStub{}, EbookInternalPrefix: "/_protected/ebooks", EbookMaxUploadBytes: 50 << 20,
		LocalDebugAuth: true,
	})

	for _, request := range []*http.Request{
		httptest.NewRequest(http.MethodGet, "/api/v1/admin/books", nil),
		httptest.NewRequest(http.MethodGet, "/api/v1/me/books", nil),
	} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Fatalf("%s: expected 200 with the bypass armed and no cookie, got %d: %s", request.URL.Path, recorder.Code, recorder.Body.String())
		}
	}

	meRecorder := httptest.NewRecorder()
	router.ServeHTTP(meRecorder, httptest.NewRequest(http.MethodGet, "/api/v1/me", nil))
	var me struct {
		IsAdmin bool `json:"isAdmin"`
	}
	if err := json.Unmarshal(meRecorder.Body.Bytes(), &me); err != nil {
		t.Fatalf("decode /api/v1/me response: %v (%s)", err, meRecorder.Body.String())
	}
	if !me.IsAdmin {
		t.Fatalf("expected /api/v1/me to report an administrator with the bypass armed, got: %s", meRecorder.Body.String())
	}
}

// TestLocalDebugAuthNeverArmsInProduction is the belt-and-suspenders half
// of config.Config.LocalDebugAuth: even if LOCAL_ADMIN_BYPASS ended up set
// on a real deploy by mistake, Dependencies.LocalDebugAuth=false (what
// main.go would compute for Environment=="production" regardless of that
// var) must still enforce the real session check.
func TestLocalDebugAuthNeverArmsInProduction(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
		LocalDebugAuth: false, // what main.go computes once Environment == "production"
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/books", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with no cookie and the bypass off, got %d: %s", recorder.Code, recorder.Body.String())
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
		Authentication: &authServiceStub{}, Database: healthStub{err: errors.New("down")}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
}

func TestGoogleLoginSetsProtectedFlowCookies(t *testing.T) {
	t.Parallel()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google", nil)
	testRouter(authorizerStub{}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusFound {
		t.Fatalf("expected redirect, got %d: %s", recorder.Code, recorder.Body.String())
	}
	cookies := recorder.Result().Cookies()
	if len(cookies) != 3 {
		t.Fatalf("expected three flow cookies, got %d", len(cookies))
	}
	for _, cookie := range cookies {
		if !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
			t.Fatalf("flow cookie is not protected: %#v", cookie)
		}
	}
}

func TestLogoutAcceptsEmptyBodyAndRevokesCookie(t *testing.T) {
	t.Parallel()
	service := &authServiceStub{}
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: service, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	request.Header.Set("Origin", "http://localhost:5173")
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent || service.logoutToken != "opaque-token" {
		t.Fatalf("unexpected logout: status=%d token=%q body=%s", recorder.Code, service.logoutToken, recorder.Body.String())
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
