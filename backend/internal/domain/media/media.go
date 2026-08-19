package media

import (
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("media not found")
	ErrInUse          = errors.New("media is in use")
	ErrInvalidImage   = errors.New("invalid image")
	ErrImageTooLarge  = errors.New("image is too large")
	ErrDimensionsHigh = errors.New("image dimensions are too large")
)

type Asset struct {
	ID               string
	Filename         string
	OriginalFilename string
	StoragePath      string
	MIMEType         string
	SizeBytes        int64
	Width            int
	Height           int
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
