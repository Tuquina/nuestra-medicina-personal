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

type LocalEbookStorage struct {
	root string
}

func NewLocalEbookStorage(root string) (*LocalEbookStorage, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve ebook storage path: %w", err)
	}
	if err := os.MkdirAll(absolute, 0o750); err != nil {
		return nil, fmt.Errorf("create ebook storage path: %w", err)
	}
	return &LocalEbookStorage{root: absolute}, nil
}

func (s *LocalEbookStorage) Save(ctx context.Context, key string, content io.Reader) error {
	target, err := s.resolve(key)
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(s.root, ".upload-*")
	if err != nil {
		return fmt.Errorf("create temporary ebook: %w", err)
	}
	temporaryName := temporary.Name()
	defer func() {
		_ = temporary.Close()
		_ = os.Remove(temporaryName)
	}()

	if _, err := copyWithContext(ctx, temporary, content); err != nil {
		return fmt.Errorf("write temporary ebook: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("sync temporary ebook: %w", err)
	}
	if err := temporary.Chmod(0o640); err != nil {
		return fmt.Errorf("set ebook permissions: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary ebook: %w", err)
	}
	if err := os.Rename(temporaryName, target); err != nil {
		return fmt.Errorf("commit ebook: %w", err)
	}
	return nil
}

func (s *LocalEbookStorage) Delete(_ context.Context, key string) error {
	target, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete ebook: %w", err)
	}
	return nil
}

func (s *LocalEbookStorage) resolve(key string) (string, error) {
	if key == "" || filepath.Base(key) != key || strings.ContainsAny(key, `/\\`) {
		return "", errors.New("invalid ebook storage key")
	}
	return filepath.Join(s.root, key), nil
}

func copyWithContext(ctx context.Context, destination io.Writer, source io.Reader) (int64, error) {
	buffer := make([]byte, 32*1024)
	var written int64
	for {
		if err := ctx.Err(); err != nil {
			return written, err
		}
		read, readErr := source.Read(buffer)
		if read > 0 {
			count, writeErr := destination.Write(buffer[:read])
			written += int64(count)
			if writeErr != nil {
				return written, writeErr
			}
			if count != read {
				return written, io.ErrShortWrite
			}
		}
		if errors.Is(readErr, io.EOF) {
			return written, nil
		}
		if readErr != nil {
			return written, readErr
		}
	}
}
