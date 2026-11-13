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

	"github.com/nuestra-medicina-personal/backend/internal/application/toolentries"
	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
)

type toolEntriesServiceStub struct {
	enabled   bool
	lastUser  string
	lastRef   toolentry.Ref
	lastData  string
	lastAfter *toolentry.Cursor
	// storedRevision makes Put reject older revisions, like the real service.
	storedRevision int64
}

func (s *toolEntriesServiceStub) Enabled() bool { return s.enabled }

func (s *toolEntriesServiceStub) List(_ context.Context, userID, tool string, after *toolentry.Cursor, _ int) (toolentries.Page, error) {
	s.lastUser, s.lastAfter = userID, after
	if err := toolentry.ValidateTool(tool); err != nil {
		return toolentries.Page{}, err
	}
	at := time.Date(2026, 11, 13, 20, 0, 0, 0, time.UTC)
	return toolentries.Page{
		Entries: []toolentry.Entry{{
			Ref:  toolentry.Ref{Tool: tool, Kind: "day", Key: "2026-11-13"},
			Data: json.RawMessage(`{"text":"hola"}`), CreatedAt: at, UpdatedAt: at,
		}},
		Next: &toolentry.Cursor{Kind: "day", Key: "2026-11-13"},
	}, nil
}

func (s *toolEntriesServiceStub) Put(_ context.Context, userID string, ref toolentry.Ref, data json.RawMessage, revision int64) (toolentry.Entry, error) {
	if revision < s.storedRevision {
		return toolentry.Entry{}, toolentry.ErrStaleRevision
	}
	s.lastUser, s.lastRef, s.lastData = userID, ref, string(data)
	if err := ref.Validate(); err != nil {
		return toolentry.Entry{}, err
	}
	return toolentry.Entry{Ref: ref, Data: data}, nil
}

func (s *toolEntriesServiceStub) Delete(_ context.Context, userID string, ref toolentry.Ref) error {
	s.lastUser, s.lastRef = userID, ref
	return nil
}

func (s *toolEntriesServiceStub) DeleteAll(_ context.Context, userID, _, kind string) error {
	s.lastRef.Kind = kind
	s.lastUser = userID
	return nil
}

func toolEntriesRouter(service ToolEntriesService, localDebug bool) http.Handler {
	return NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		BaseURL: "http://localhost:5173", SessionCookie: "nmp_session", ToolEntries: service,
		LocalDebugAuth: localDebug,
	})
}

func toolRequest(method, target, body string, withSession, withOrigin bool) *http.Request {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	request := httptest.NewRequest(method, target, reader)
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	if withSession {
		request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	}
	if withOrigin {
		request.Header.Set("Origin", "http://localhost:5173")
	}
	return request
}

func TestToolEntriesRequireASession(t *testing.T) {
	t.Parallel()
	router := toolEntriesRouter(&toolEntriesServiceStub{enabled: true}, false)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodGet, "/api/v1/me/tools/escritura-diaria/entries", "", false, false))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a session, got %d", recorder.Code)
	}
}

func TestToolEntriesListUsesTheSessionUserAndIsNotCached(t *testing.T) {
	t.Parallel()
	service := &toolEntriesServiceStub{enabled: true}
	router := toolEntriesRouter(service, false)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodGet, "/api/v1/me/tools/escritura-diaria/entries?cursor=day/2026-11-01", "", true, false))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if service.lastUser != "user-1" || service.lastAfter == nil || service.lastAfter.Key != "2026-11-01" {
		t.Fatalf("expected the session user and cursor to reach the service, got %q %+v", service.lastUser, service.lastAfter)
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("tool entries must never be cached")
	}
	var body struct {
		Entries []struct {
			Kind string          `json:"kind"`
			Key  string          `json:"key"`
			Data json.RawMessage `json:"data"`
		} `json:"entries"`
		NextCursor *string `json:"nextCursor"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Entries) != 1 || string(body.Entries[0].Data) != `{"text":"hola"}` || body.NextCursor == nil || *body.NextCursor != "day/2026-11-13" {
		t.Fatalf("unexpected body %s", recorder.Body.String())
	}
}

func TestToolEntriesWritesRequireSameOrigin(t *testing.T) {
	t.Parallel()
	service := &toolEntriesServiceStub{enabled: true}
	router := toolEntriesRouter(service, false)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodPut, "/api/v1/me/tools/escritura-diaria/entries/day/2026-11-13", `{"data":{"text":"x"}}`, true, false))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 without Origin, got %d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodPut, "/api/v1/me/tools/escritura-diaria/entries/day/2026-11-13", `{"data":{"text":"x"}}`, true, true))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if service.lastUser != "user-1" || service.lastRef.Key != "2026-11-13" || service.lastData != `{"text":"x"}` {
		t.Fatalf("unexpected call %+v", service)
	}

	for _, target := range []string{"/api/v1/me/tools/escritura-diaria/entries/day/2026-11-13", "/api/v1/me/tools/escritura-diaria/entries?kind=day"} {
		recorder = httptest.NewRecorder()
		router.ServeHTTP(recorder, toolRequest(http.MethodDelete, target, "", true, true))
		if recorder.Code != http.StatusNoContent {
			t.Fatalf("expected 204 for DELETE %s, got %d", target, recorder.Code)
		}
	}
}

func TestToolEntriesRejectInvalidRefs(t *testing.T) {
	t.Parallel()
	router := toolEntriesRouter(&toolEntriesServiceStub{enabled: true}, false)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodPut, "/api/v1/me/tools/escritura-diaria/entries/answer/x", `{"data":{}}`, true, true))
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for a kind the tool doesn't store, got %d", recorder.Code)
	}
}

func TestToolEntriesUnavailableWithoutKeyOrUnderLocalDebug(t *testing.T) {
	t.Parallel()
	for name, router := range map[string]http.Handler{
		"no key":      toolEntriesRouter(&toolEntriesServiceStub{enabled: false}, false),
		"local debug": toolEntriesRouter(&toolEntriesServiceStub{enabled: true}, true),
		"no service":  toolEntriesRouter(nil, false),
	} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, toolRequest(http.MethodGet, "/api/v1/me/tools/preguntas/entries", "", true, false))
		if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "PERSONAL_STORAGE_UNAVAILABLE") {
			t.Fatalf("%s: expected 503 PERSONAL_STORAGE_UNAVAILABLE, got %d %s", name, recorder.Code, recorder.Body.String())
		}
	}
}

func TestToolEntriesStaleRevisionIsAConflict(t *testing.T) {
	t.Parallel()
	router := toolEntriesRouter(&toolEntriesServiceStub{enabled: true, storedRevision: 10}, false)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, toolRequest(http.MethodPut, "/api/v1/me/tools/escritura-diaria/entries/day/2026-11-13", `{"data":{"text":"viejo"},"revision":9}`, true, true))
	if recorder.Code != http.StatusConflict || !strings.Contains(recorder.Body.String(), "TOOL_ENTRY_STALE") {
		t.Fatalf("expected 409 TOOL_ENTRY_STALE for an older revision, got %d %s", recorder.Code, recorder.Body.String())
	}
}
