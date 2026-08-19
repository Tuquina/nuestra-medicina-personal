package library

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
)

type repositoryStub struct {
	attachedKey string
	previousKey string
	err         error
}

func (r *repositoryStub) ListForUser(context.Context, string) ([]librarydomain.Book, error) {
	return nil, nil
}
func (r *repositoryStub) GetDownloadForUser(context.Context, string, string) (librarydomain.Download, error) {
	return librarydomain.Download{}, nil
}
func (r *repositoryStub) AttachEbook(_ context.Context, _ string, key, _ string, _ int64, _ time.Time) (string, error) {
	r.attachedKey = key
	return r.previousKey, r.err
}

type bookServiceStub struct{ value book.Book }

func (s bookServiceStub) Get(context.Context, string) (book.Book, error) { return s.value, nil }

type storageStub struct {
	saved   map[string][]byte
	deleted []string
}

func (s *storageStub) Save(_ context.Context, key string, content io.Reader) error {
	value, err := io.ReadAll(content)
	if err == nil {
		s.saved[key] = value
	}
	return err
}
func (s *storageStub) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	delete(s.saved, key)
	return nil
}

func TestUploadPDFStoresOpaqueKeyAndReplacesPreviousFile(t *testing.T) {
	repository := &repositoryStub{previousKey: "previous.pdf"}
	storage := &storageStub{saved: map[string][]byte{"previous.pdf": []byte("old")}}
	service := NewService(repository, bookServiceStub{value: book.Book{ID: "book-1", Title: "Mi libro"}}, storage, 1<<20)
	service.newKey = func(extension string) (string, error) { return "opaque" + extension, nil }
	service.now = func() time.Time { return time.Date(2026, 8, 19, 12, 0, 0, 0, time.UTC) }
	content := bytes.NewReader([]byte("%PDF-1.7\ncontent"))

	stored, err := service.Upload(context.Background(), "book-1", "original.pdf", MediaTypePDF, content)
	if err != nil {
		t.Fatalf("upload PDF: %v", err)
	}
	if stored.StorageKey != "opaque.pdf" || repository.attachedKey != "opaque.pdf" {
		t.Fatalf("unexpected storage key: %#v", stored)
	}
	if _, exists := storage.saved["previous.pdf"]; exists {
		t.Fatal("previous file was not removed after successful replacement")
	}
}

func TestUploadRejectsDisguisedPDF(t *testing.T) {
	service := NewService(&repositoryStub{}, bookServiceStub{value: book.Book{ID: "book-1"}}, &storageStub{saved: map[string][]byte{}}, 1<<20)
	_, err := service.Upload(context.Background(), "book-1", "malware.pdf", MediaTypePDF, bytes.NewReader([]byte("not a pdf")))
	if !errors.Is(err, librarydomain.ErrInvalidEbook) {
		t.Fatalf("expected invalid ebook, got %v", err)
	}
}

func TestUploadAcceptsValidEPUB(t *testing.T) {
	var payload bytes.Buffer
	writer := zip.NewWriter(&payload)
	header := &zip.FileHeader{Name: "mimetype", Method: zip.Store}
	part, err := writer.CreateHeader(header)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte(MediaTypeEPUB))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	storage := &storageStub{saved: map[string][]byte{}}
	service := NewService(&repositoryStub{}, bookServiceStub{value: book.Book{ID: "book-1"}}, storage, 1<<20)
	service.newKey = func(string) (string, error) { return "opaque.epub", nil }
	if _, err := service.Upload(context.Background(), "book-1", "book.epub", MediaTypeEPUB, bytes.NewReader(payload.Bytes())); err != nil {
		t.Fatalf("upload EPUB: %v", err)
	}
}

func TestUploadDeletesNewFileWhenDatabaseUpdateFails(t *testing.T) {
	repository := &repositoryStub{err: errors.New("database unavailable")}
	storage := &storageStub{saved: map[string][]byte{}}
	service := NewService(repository, bookServiceStub{value: book.Book{ID: "book-1"}}, storage, 1<<20)
	service.newKey = func(string) (string, error) { return "new.pdf", nil }
	_, err := service.Upload(context.Background(), "book-1", "book.pdf", MediaTypePDF, bytes.NewReader([]byte("%PDF-1.7\ncontent")))
	if err == nil {
		t.Fatal("expected repository failure")
	}
	if len(storage.deleted) != 1 || storage.deleted[0] != "new.pdf" {
		t.Fatalf("new file was not compensated: %#v", storage.deleted)
	}
}
