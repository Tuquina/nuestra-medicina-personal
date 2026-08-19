package library

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	librarydomain "github.com/nuestra-medicina-personal/backend/internal/domain/library"
)

const (
	MediaTypePDF  = "application/pdf"
	MediaTypeEPUB = "application/epub+zip"
)

type UploadFile interface {
	io.Reader
	io.ReaderAt
	io.Seeker
}

type Repository interface {
	ListForUser(context.Context, string) ([]librarydomain.Book, error)
	GetDownloadForUser(context.Context, string, string) (librarydomain.Download, error)
	AttachEbook(context.Context, string, string, string, int64, time.Time) (string, error)
}

type Storage interface {
	Save(context.Context, string, io.Reader) error
	Delete(context.Context, string) error
}

type Service struct {
	repository Repository
	books      interface {
		Get(context.Context, string) (book.Book, error)
	}
	storage        Storage
	maxUploadBytes int64
	now            func() time.Time
	newKey         func(string) (string, error)
}

func NewService(repository Repository, books interface {
	Get(context.Context, string) (book.Book, error)
}, storage Storage, maxUploadBytes int64) *Service {
	return &Service{
		repository: repository, books: books, storage: storage, maxUploadBytes: maxUploadBytes,
		now: time.Now, newKey: randomStorageKey,
	}
}

func (s *Service) List(ctx context.Context, userID string) ([]librarydomain.Book, error) {
	return s.repository.ListForUser(ctx, userID)
}

func (s *Service) Download(ctx context.Context, userID, bookID string) (librarydomain.Download, error) {
	return s.repository.GetDownloadForUser(ctx, userID, bookID)
}

func (s *Service) Upload(ctx context.Context, bookIdentifier, originalFilename, declaredType string, file UploadFile) (librarydomain.StoredEbook, error) {
	selectedBook, err := s.books.Get(ctx, bookIdentifier)
	if err != nil {
		return librarydomain.StoredEbook{}, err
	}
	size, err := file.Seek(0, io.SeekEnd)
	if err != nil {
		return librarydomain.StoredEbook{}, fmt.Errorf("measure ebook: %w", err)
	}
	if size <= 0 {
		return librarydomain.StoredEbook{}, librarydomain.ErrInvalidEbook
	}
	if size > s.maxUploadBytes {
		return librarydomain.StoredEbook{}, librarydomain.ErrEbookTooLarge
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return librarydomain.StoredEbook{}, fmt.Errorf("rewind ebook: %w", err)
	}

	extension, mediaType, err := inspectEbook(file, size, originalFilename, declaredType)
	if err != nil {
		return librarydomain.StoredEbook{}, err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return librarydomain.StoredEbook{}, fmt.Errorf("rewind validated ebook: %w", err)
	}
	storageKey, err := s.newKey(extension)
	if err != nil {
		return librarydomain.StoredEbook{}, fmt.Errorf("generate ebook storage key: %w", err)
	}
	if err := s.storage.Save(ctx, storageKey, io.LimitReader(file, s.maxUploadBytes+1)); err != nil {
		return librarydomain.StoredEbook{}, fmt.Errorf("store ebook: %w", err)
	}
	previousKey, err := s.repository.AttachEbook(ctx, selectedBook.ID, storageKey, strings.TrimPrefix(extension, "."), size, s.now().UTC())
	if err != nil {
		_ = s.storage.Delete(ctx, storageKey)
		return librarydomain.StoredEbook{}, err
	}
	if previousKey != "" && previousKey != storageKey {
		_ = s.storage.Delete(ctx, previousKey)
	}
	return librarydomain.StoredEbook{
		BookID: selectedBook.ID, StorageKey: storageKey,
		Filename: safeDownloadFilename(selectedBook.Title, extension), MediaType: mediaType,
		SizeBytes: size, PreviousKey: previousKey,
	}, nil
}

func inspectEbook(file UploadFile, size int64, originalFilename, declaredType string) (string, string, error) {
	extension := strings.ToLower(filepath.Ext(originalFilename))
	declaredType, _, _ = mime.ParseMediaType(declaredType)
	var header [512]byte
	n, err := file.Read(header[:])
	if err != nil && !errors.Is(err, io.EOF) {
		return "", "", fmt.Errorf("read ebook header: %w", err)
	}
	detected := http.DetectContentType(header[:n])
	switch extension {
	case ".pdf":
		if declaredType != MediaTypePDF || detected != MediaTypePDF || !bytes.HasPrefix(header[:n], []byte("%PDF-")) {
			return "", "", librarydomain.ErrInvalidEbook
		}
		return extension, MediaTypePDF, nil
	case ".epub":
		if declaredType != MediaTypeEPUB && declaredType != "application/zip" {
			return "", "", librarydomain.ErrInvalidEbook
		}
		if err := validateEPUB(file, size); err != nil {
			return "", "", librarydomain.ErrInvalidEbook
		}
		return extension, MediaTypeEPUB, nil
	default:
		return "", "", librarydomain.ErrInvalidEbook
	}
}

func validateEPUB(file UploadFile, size int64) error {
	reader, err := zip.NewReader(file, size)
	if err != nil {
		return err
	}
	for _, item := range reader.File {
		if item.Name != "mimetype" {
			continue
		}
		content, err := item.Open()
		if err != nil {
			return err
		}
		defer content.Close()
		value, err := io.ReadAll(io.LimitReader(content, 64))
		if err != nil {
			return err
		}
		if string(value) == MediaTypeEPUB {
			return nil
		}
	}
	return librarydomain.ErrInvalidEbook
}

func safeDownloadFilename(title, extension string) string {
	cleaned := strings.Map(func(value rune) rune {
		switch {
		case value >= 'a' && value <= 'z', value >= 'A' && value <= 'Z', value >= '0' && value <= '9', value == ' ', value == '-', value == '_':
			return value
		default:
			return -1
		}
	}, title)
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		cleaned = "ebook"
	}
	return cleaned + extension
}

func randomStorageKey(extension string) (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x%s",
		value[0:4], value[4:6], value[6:8], value[8:10], value[10:16], extension), nil
}
