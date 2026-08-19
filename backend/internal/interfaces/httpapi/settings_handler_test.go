package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

type settingsServiceStub struct {
	value settingsdomain.Settings
	err   error
}

func (stub *settingsServiceStub) Get(context.Context) (settingsdomain.Settings, error) {
	return stub.value, stub.err
}
func (stub *settingsServiceStub) Update(_ context.Context, value settingsdomain.Settings) (settingsdomain.Settings, error) {
	stub.value = value
	return value, stub.err
}

func TestSettingsResponseReportsRuntimeIntegrations(t *testing.T) {
	t.Parallel()
	handler := NewSettingsHandler(&settingsServiceStub{value: settingsdomain.Settings{SiteName: "Site"}}, slog.New(slog.NewTextHandler(io.Discard, nil)), IntegrationStatus{GoogleConfigured: true})
	recorder := httptest.NewRecorder()
	handler.Get(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/settings", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"google":{"configured":true}`) || !strings.Contains(recorder.Body.String(), `"email":{"configured":false}`) {
		t.Fatalf("unexpected settings response: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestSettingsRejectsUnknownJSONFields(t *testing.T) {
	t.Parallel()
	handler := NewSettingsHandler(&settingsServiceStub{}, slog.New(slog.NewTextHandler(io.Discard, nil)), IntegrationStatus{})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/settings", strings.NewReader(`{"siteName":"Site","unexpected":true}`))
	handler.Update(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestSettingsRouteRequiresAdmin(t *testing.T) {
	t.Parallel()
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{},
		Authentication: &authServiceStub{}, Database: healthStub{}, AdminAuthorizer: authorizerStub{},
		Settings: &settingsServiceStub{}, BaseURL: "http://localhost:5173", SessionCookie: "nmp_session",
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/settings", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
