package storage

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalEbookStorageSavesAndDeletesInsideRoot(t *testing.T) {
	root := t.TempDir()
	storage, err := NewLocalEbookStorage(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := storage.Save(context.Background(), "book.pdf", bytes.NewBufferString("content")); err != nil {
		t.Fatalf("save: %v", err)
	}
	value, err := os.ReadFile(filepath.Join(root, "book.pdf"))
	if err != nil || string(value) != "content" {
		t.Fatalf("stored value: %q, %v", value, err)
	}
	if err := storage.Delete(context.Background(), "book.pdf"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "book.pdf")); !os.IsNotExist(err) {
		t.Fatalf("expected file removal, got %v", err)
	}
}

func TestLocalEbookStorageRejectsTraversal(t *testing.T) {
	storage, err := NewLocalEbookStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"../outside.pdf", "folder/book.pdf", `folder\book.pdf`, ""} {
		if err := storage.Save(context.Background(), key, bytes.NewBufferString("content")); err == nil {
			t.Fatalf("expected key %q to be rejected", key)
		}
	}
}
