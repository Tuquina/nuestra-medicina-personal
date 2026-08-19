package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	mediadomain "github.com/nuestra-medicina-personal/backend/internal/domain/media"
)

const maxImageDimension = 8_000

type Repository interface {
	List(context.Context) ([]mediadomain.Asset, error)
	Create(context.Context, mediadomain.Asset) (mediadomain.Asset, error)
	Delete(context.Context, string) (mediadomain.Asset, error)
}

type Storage interface {
	Save(context.Context, string, io.Reader) error
	Delete(context.Context, string) error
}

type Service struct {
	repository     Repository
	storage        Storage
	maxUploadBytes int64
	now            func() time.Time
	newID          func() (string, error)
}

func NewService(repository Repository, storage Storage, maxUploadBytes int64) *Service {
	return &Service{
		repository: repository, storage: storage, maxUploadBytes: maxUploadBytes,
		now: time.Now, newID: randomUUID,
	}
}

func (s *Service) List(ctx context.Context) ([]mediadomain.Asset, error) {
	return s.repository.List(ctx)
}

func (s *Service) Upload(ctx context.Context, originalFilename, declaredType string, content io.Reader) (mediadomain.Asset, error) {
	payload, err := io.ReadAll(io.LimitReader(content, s.maxUploadBytes+1))
	if err != nil {
		return mediadomain.Asset{}, fmt.Errorf("read image: %w", err)
	}
	if len(payload) == 0 {
		return mediadomain.Asset{}, mediadomain.ErrInvalidImage
	}
	if int64(len(payload)) > s.maxUploadBytes {
		return mediadomain.Asset{}, mediadomain.ErrImageTooLarge
	}
	extension, mediaType, width, height, err := inspectImage(payload, originalFilename, declaredType)
	if err != nil {
		return mediadomain.Asset{}, err
	}
	id, err := s.newID()
	if err != nil {
		return mediadomain.Asset{}, fmt.Errorf("generate media id: %w", err)
	}
	key := id + extension
	now := s.now().UTC()
	asset := mediadomain.Asset{
		ID: id, Filename: key, OriginalFilename: filepath.Base(originalFilename), StoragePath: key,
		MIMEType: mediaType, SizeBytes: int64(len(payload)), Width: width, Height: height,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.storage.Save(ctx, key, bytes.NewReader(payload)); err != nil {
		return mediadomain.Asset{}, fmt.Errorf("store image: %w", err)
	}
	created, err := s.repository.Create(ctx, asset)
	if err != nil {
		_ = s.storage.Delete(ctx, key)
		return mediadomain.Asset{}, err
	}
	return created, nil
}

func (s *Service) Delete(ctx context.Context, identifier string) error {
	deleted, err := s.repository.Delete(ctx, identifier)
	if err != nil {
		return err
	}
	if err := s.storage.Delete(ctx, deleted.StoragePath); err != nil {
		return fmt.Errorf("delete image file: %w", err)
	}
	return nil
}

func inspectImage(payload []byte, originalFilename, declaredType string) (string, string, int, int, error) {
	extension := strings.ToLower(filepath.Ext(originalFilename))
	declaredType, _, _ = mime.ParseMediaType(declaredType)
	detectedType := http.DetectContentType(payload)
	expectedType := ""
	switch extension {
	case ".jpg", ".jpeg":
		extension = ".jpg"
		expectedType = "image/jpeg"
	case ".png":
		expectedType = "image/png"
	default:
		return "", "", 0, 0, mediadomain.ErrInvalidImage
	}
	if declaredType != expectedType || detectedType != expectedType {
		return "", "", 0, 0, mediadomain.ErrInvalidImage
	}
	configuration, format, err := image.DecodeConfig(bytes.NewReader(payload))
	if err != nil || (format != "jpeg" && format != "png") || configuration.Width <= 0 || configuration.Height <= 0 {
		return "", "", 0, 0, mediadomain.ErrInvalidImage
	}
	if configuration.Width > maxImageDimension || configuration.Height > maxImageDimension {
		return "", "", 0, 0, mediadomain.ErrDimensionsHigh
	}
	return extension, expectedType, configuration.Width, configuration.Height, nil
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}

func IsValidationError(err error) bool {
	return errors.Is(err, mediadomain.ErrInvalidImage) || errors.Is(err, mediadomain.ErrImageTooLarge) || errors.Is(err, mediadomain.ErrDimensionsHigh)
}
