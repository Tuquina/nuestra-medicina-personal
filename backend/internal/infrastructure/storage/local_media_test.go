package storage

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalMediaStorageWritesAndDeletesOpaqueKey(t *testing.T) {
	root := t.TempDir()
	storage, err := NewLocalMediaStorage(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := storage.Save(context.Background(), "asset.png", bytes.NewReader([]byte("png"))); err != nil {
		t.Fatalf("save media: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "asset.png")); err != nil {
		t.Fatalf("stored media not found: %v", err)
	}
	if err := storage.Delete(context.Background(), "asset.png"); err != nil {
		t.Fatalf("delete media: %v", err)
	}
}

func TestLocalMediaStorageRejectsTraversal(t *testing.T) {
	storage, err := NewLocalMediaStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := storage.Save(context.Background(), "../escape.png", bytes.NewReader(nil)); err == nil {
		t.Fatal("expected traversal rejection")
	}
}
