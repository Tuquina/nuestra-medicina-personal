package media

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"io"
	"testing"
	"time"

	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

type repositoryStub struct {
	created mediadomain.Asset
	deleted mediadomain.Asset
}

func (*repositoryStub) List(context.Context) ([]mediadomain.Asset, error) { return nil, nil }
func (repository *repositoryStub) Get(context.Context, string) (mediadomain.Asset, error) {
	return repository.created, nil
}
func (repository *repositoryStub) Create(_ context.Context, asset mediadomain.Asset) (mediadomain.Asset, error) {
	repository.created = asset
	return asset, nil
}
func (repository *repositoryStub) Delete(context.Context, string) (mediadomain.Asset, error) {
	return repository.deleted, nil
}

type storageStub struct {
	key     string
	payload []byte
	deleted string
}

func (storage *storageStub) Save(_ context.Context, key string, content io.Reader) error {
	storage.key = key
	storage.payload, _ = io.ReadAll(content)
	return nil
}
func (*storageStub) Open(context.Context, string) (mediadomain.ReadSeekCloser, error) {
	return nil, nil
}
func (storage *storageStub) Delete(_ context.Context, key string) error {
	storage.deleted = key
	return nil
}

func TestUploadValidatesAndStoresPNG(t *testing.T) {
	repository := &repositoryStub{}
	storage := &storageStub{}
	service := NewService(repository, storage, 1<<20)
	service.newID = func() (string, error) { return "10000000-0000-4000-8000-000000000001", nil }
	service.now = func() time.Time { return time.Date(2026, 8, 19, 22, 0, 0, 0, time.UTC) }
	payload := testPNG(t, 3, 2)

	created, err := service.Upload(context.Background(), "portada.png", "image/png", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("upload image: %v", err)
	}
	if created.Width != 3 || created.Height != 2 || created.MIMEType != "image/png" {
		t.Fatalf("unexpected image metadata: %#v", created)
	}
	if storage.key != created.StoragePath || !bytes.Equal(storage.payload, payload) {
		t.Fatal("storage did not receive validated image")
	}
}

func TestUploadRejectsMIMEAndExtensionMismatch(t *testing.T) {
	service := NewService(&repositoryStub{}, &storageStub{}, 1<<20)
	_, err := service.Upload(context.Background(), "portada.jpg", "image/jpeg", bytes.NewReader(testPNG(t, 1, 1)))
	if err != mediadomain.ErrInvalidImage {
		t.Fatalf("expected invalid image, got %v", err)
	}
}

func TestUploadRejectsOversizedInputBeforeStorage(t *testing.T) {
	storage := &storageStub{}
	service := NewService(&repositoryStub{}, storage, 4)
	_, err := service.Upload(context.Background(), "portada.png", "image/png", bytes.NewReader([]byte("12345")))
	if err != mediadomain.ErrImageTooLarge {
		t.Fatalf("expected image too large, got %v", err)
	}
	if storage.key != "" {
		t.Fatal("oversized image reached storage")
	}
}

func testPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	value := image.NewRGBA(image.Rect(0, 0, width, height))
	value.Set(0, 0, color.RGBA{R: 20, G: 40, B: 60, A: 255})
	var payload bytes.Buffer
	if err := png.Encode(&payload, value); err != nil {
		t.Fatalf("encode PNG: %v", err)
	}
	return payload.Bytes()
}
