package manuscript

import (
	"errors"
	"time"
)

const (
	MaxChapters     = 200
	MaxChapterBytes = 2 << 20 // 2 MiB of HTML per chapter
)

var (
	ErrNotFound          = errors.New("manuscript not found")
	ErrUnsupportedFormat = errors.New("unsupported manuscript file format")
	ErrConversionFailed  = errors.New("manuscript file could not be converted")
)

type Chapter struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	HTML  string `json:"html"`
}

type Manuscript struct {
	BookID    string
	Chapters  []Chapter
	UpdatedAt time.Time
}

type ValidationError struct{ Fields map[string]string }

func (e *ValidationError) Error() string { return "manuscript is invalid" }

// Validate keeps a runaway autosave loop from growing book_manuscripts.chapters
// without bound — proportional guardrails, not a real size limit a normal
// author would ever hit.
func (m Manuscript) Validate() error {
	fields := make(map[string]string)
	if len(m.Chapters) > MaxChapters {
		fields["chapters"] = "must contain at most 200 chapters"
	}
	for _, chapter := range m.Chapters {
		if len(chapter.HTML) > MaxChapterBytes {
			fields["chapters"] = "each chapter must be at most 2MB of HTML"
			break
		}
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}
