package library

import (
	"errors"
	"time"
)

var (
	ErrBookNotAvailable = errors.New("book is not available in the user's library")
	ErrInvalidEbook     = errors.New("ebook must be a valid PDF or EPUB file")
	ErrEbookTooLarge    = errors.New("ebook exceeds the upload size limit")
)

type Book struct {
	ID                string
	Slug              string
	Title             string
	CoverMediaID      *string
	Format            string
	FileSizeBytes     *int64
	PurchasedAt       time.Time
	DownloadAvailable bool
}

type Download struct {
	StorageKey string
	Filename   string
	MediaType  string
}

type StoredEbook struct {
	BookID      string
	StorageKey  string
	Filename    string
	MediaType   string
	SizeBytes   int64
	PreviousKey string
}
