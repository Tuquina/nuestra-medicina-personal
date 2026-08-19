package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type LocalMediaStorage struct {
	root string
}

func NewLocalMediaStorage(root string) (*LocalMediaStorage, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve media storage path: %w", err)
	}
	if err := os.MkdirAll(absolute, 0o750); err != nil {
		return nil, fmt.Errorf("create media storage path: %w", err)
	}
	return &LocalMediaStorage{root: absolute}, nil
}

func (s *LocalMediaStorage) Save(ctx context.Context, key string, content io.Reader) error {
	target, err := s.resolve(key)
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(s.root, ".upload-*")
	if err != nil {
		return fmt.Errorf("create temporary media: %w", err)
	}
	temporaryName := temporary.Name()
	defer func() {
		_ = temporary.Close()
		_ = os.Remove(temporaryName)
	}()
	if _, err := copyWithContext(ctx, temporary, content); err != nil {
		return fmt.Errorf("write temporary media: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("sync temporary media: %w", err)
	}
	if err := temporary.Chmod(0o640); err != nil {
		return fmt.Errorf("set media permissions: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary media: %w", err)
	}
	if err := os.Rename(temporaryName, target); err != nil {
		return fmt.Errorf("commit media: %w", err)
	}
	return nil
}

func (s *LocalMediaStorage) Delete(_ context.Context, key string) error {
	target, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete media: %w", err)
	}
	return nil
}

func (s *LocalMediaStorage) resolve(key string) (string, error) {
	if key == "" || filepath.Base(key) != key || strings.ContainsAny(key, `/\\`) {
		return "", errors.New("invalid media storage key")
	}
	return filepath.Join(s.root, key), nil
}
