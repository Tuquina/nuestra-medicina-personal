package httpapi

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

type mediaServiceStub struct {
	asset   mediadomain.Asset
	payload []byte
	err     error
}

func (stub *mediaServiceStub) List(context.Context) ([]mediadomain.Asset, error) {
	return []mediadomain.Asset{stub.asset}, stub.err
}
func (stub *mediaServiceStub) Open(context.Context, string) (mediadomain.Asset, mediadomain.ReadSeekCloser, error) {
	if stub.err != nil {
		return mediadomain.Asset{}, nil, stub.err
	}
	return stub.asset, &memoryFile{Reader: bytes.NewReader(stub.payload)}, nil
}
func (stub *mediaServiceStub) Upload(context.Context, string, string, io.Reader) (mediadomain.Asset, error) {
	return stub.asset, stub.err
}
func (stub *mediaServiceStub) Delete(context.Context, string) error { return stub.err }

type memoryFile struct{ *bytes.Reader }

func (*memoryFile) Close() error { return nil }

func TestPublicMediaStreamsWithoutAuthentication(t *testing.T) {
	t.Parallel()
	payload := []byte("image-payload")
	stub := &mediaServiceStub{asset: mediadomain.Asset{
		ID: "10000000-0000-4000-8000-000000000001", OriginalFilename: "cover.png",
		MIMEType: "image/png", SizeBytes: int64(len(payload)), UpdatedAt: time.Now(),
	}, payload: payload}
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{}, Authentication: &authServiceStub{},
		Library: libraryServiceStub{}, Pages: &pageServiceStub{}, Media: stub,
		Database: healthStub{}, AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173",
		SessionCookie: "nmp_session", EbookInternalPrefix: "/_protected/ebooks",
		EbookMaxUploadBytes: 50 << 20, MediaMaxUploadBytes: 10 << 20,
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/media/10000000-0000-4000-8000-000000000001", nil))
	if recorder.Code != http.StatusOK || !bytes.Equal(recorder.Body.Bytes(), payload) {
		t.Fatalf("unexpected media response: %d %q", recorder.Code, recorder.Body.Bytes())
	}
	if recorder.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("unexpected cache policy: %q", recorder.Header().Get("Cache-Control"))
	}
}

func TestReferencedMediaDeletionReturnsConflict(t *testing.T) {
	t.Parallel()
	stub := &mediaServiceStub{err: mediadomain.ErrInUse}
	router := NewRouter(Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Books: bookServiceStub{}, Authentication: &authServiceStub{},
		Library: libraryServiceStub{}, Pages: &pageServiceStub{}, Media: stub,
		Database: healthStub{}, AdminAuthorizer: authorizerStub{}, BaseURL: "http://localhost:5173",
		SessionCookie: "nmp_session", EbookInternalPrefix: "/_protected/ebooks", MediaMaxUploadBytes: 10 << 20,
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/media/10000000-0000-4000-8000-000000000001", nil)
	request.Header.Set("Origin", "http://localhost:5173")
	request.AddCookie(&http.Cookie{Name: "nmp_session", Value: "opaque-token"})
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected conflict, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
