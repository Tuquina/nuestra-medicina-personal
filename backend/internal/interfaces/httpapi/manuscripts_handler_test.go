package httpapi

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type manuscriptServiceStub struct {
	getValue    manuscript.Manuscript
	saveValue   manuscript.Manuscript
	importValue manuscript.Manuscript
	importErr   error
	exportData  []byte
	exportName  string
	exportErr   error
}

func (s manuscriptServiceStub) Get(context.Context, string) (manuscript.Manuscript, error) {
	return s.getValue, nil
}
func (s manuscriptServiceStub) Save(context.Context, string, []manuscript.Chapter) (manuscript.Manuscript, error) {
	return s.saveValue, nil
}
func (s manuscriptServiceStub) Import(context.Context, string, string, []byte) (manuscript.Manuscript, error) {
	return s.importValue, s.importErr
}
func (s manuscriptServiceStub) Export(context.Context, string, string) ([]byte, string, error) {
	return s.exportData, s.exportName, s.exportErr
}

func multipartManuscriptRequest(t *testing.T, filename string, content []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}
	request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/books/book-1/manuscript/import", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.SetPathValue("identifier", "book-1")
	return request
}

func TestManuscriptImportRejectsRequestWithoutFileField(t *testing.T) {
	handler := NewManuscriptHandler(manuscriptServiceStub{}, slog.New(slog.NewTextHandler(io.Discard, nil)), 20<<20)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writer.Close()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/books/book-1/manuscript/import", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()

	handler.Import(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestManuscriptImportReportsUnsupportedFormat(t *testing.T) {
	handler := NewManuscriptHandler(
		manuscriptServiceStub{importErr: manuscript.ErrUnsupportedFormat},
		slog.New(slog.NewTextHandler(io.Discard, nil)), 20<<20,
	)
	recorder := httptest.NewRecorder()

	handler.Import(recorder, multipartManuscriptRequest(t, "manuscript.rtf", []byte("content")))

	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestManuscriptImportPersistsSuccessfully(t *testing.T) {
	handler := NewManuscriptHandler(
		manuscriptServiceStub{importValue: manuscript.Manuscript{BookID: "book-1", Chapters: []manuscript.Chapter{{ID: 1, Title: "Capítulo 1", HTML: "<p>Hola</p>"}}}},
		slog.New(slog.NewTextHandler(io.Discard, nil)), 20<<20,
	)
	recorder := httptest.NewRecorder()

	handler.Import(recorder, multipartManuscriptRequest(t, "manuscript.txt", []byte("Hola")))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestManuscriptExportStreamsGeneratedFileWithAttachmentHeaders(t *testing.T) {
	handler := NewManuscriptHandler(
		manuscriptServiceStub{exportData: []byte("%PDF-fake-content"), exportName: "un-libro.pdf"},
		slog.New(slog.NewTextHandler(io.Discard, nil)), 20<<20,
	)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/books/book-1/manuscript/export?format=pdf", nil)
	request.SetPathValue("identifier", "book-1")
	recorder := httptest.NewRecorder()

	handler.Export(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if recorder.Header().Get("Content-Type") != "application/pdf" {
		t.Fatalf("unexpected content type: %s", recorder.Header().Get("Content-Type"))
	}
	if disposition := recorder.Header().Get("Content-Disposition"); disposition == "" {
		t.Fatal("expected a Content-Disposition header for the download")
	}
	if recorder.Body.String() != "%PDF-fake-content" {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestManuscriptExportReportsUnsupportedFormat(t *testing.T) {
	handler := NewManuscriptHandler(
		manuscriptServiceStub{exportErr: manuscript.ErrUnsupportedFormat},
		slog.New(slog.NewTextHandler(io.Discard, nil)), 20<<20,
	)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/books/book-1/manuscript/export?format=mobi", nil)
	request.SetPathValue("identifier", "book-1")
	recorder := httptest.NewRecorder()

	handler.Export(recorder, request)

	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
