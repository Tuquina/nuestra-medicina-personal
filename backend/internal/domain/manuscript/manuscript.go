package manuscript

import (
	"errors"
	"time"
)

const (
	MaxChapters = 200
	// 8 MiB of HTML per chapter — up from the original 2 MiB now that a
	// chapter can carry a few embedded (base64) images, not just text.
	MaxChapterBytes = 8 << 20
)

var (
	ErrNotFound          = errors.New("manuscript not found")
	ErrUnsupportedFormat = errors.New("unsupported manuscript file format")
	ErrConversionFailed  = errors.New("manuscript file could not be converted")
)

// SectionKind classifies what a chapter *is* in the finished book, beyond
// just "a chapter" — a portada, a prólogo, an epílogo, etc. It only ever
// changes how the editor labels/numbers the section and, for SectionKindCover,
// how ExportPDF styles its heading; the actual heading text rendered in both
// exports always comes from Chapter.Title, which the frontend already
// resolves to either the kind's default label or the author's own custom
// title before saving. An empty/unrecognized Kind is treated as
// SectionKindChapter throughout, so manuscripts saved before this field
// existed keep behaving exactly as before.
type SectionKind string

const (
	SectionKindCover           SectionKind = "COVER"
	SectionKindDedication      SectionKind = "DEDICATION"
	SectionKindPrologue        SectionKind = "PROLOGUE"
	SectionKindIntroduction    SectionKind = "INTRODUCTION"
	SectionKindChapter         SectionKind = "CHAPTER"
	SectionKindEpilogue        SectionKind = "EPILOGUE"
	SectionKindAcknowledgments SectionKind = "ACKNOWLEDGMENTS"
	SectionKindAppendix        SectionKind = "APPENDIX"
	SectionKindCustom          SectionKind = "CUSTOM"
)

// TitleMode records whether Chapter.Title is the kind's auto-generated
// label (e.g. "Capítulo 3") or text the author typed themselves — purely
// so the editor can restore the right toggle state after reloading; both
// exports only ever read the already-resolved Title.
type TitleMode string

const (
	TitleModeAuto   TitleMode = "AUTO"
	TitleModeCustom TitleMode = "CUSTOM"
)

type Chapter struct {
	ID        int         `json:"id"`
	Title     string      `json:"title"`
	HTML      string      `json:"html"`
	Kind      SectionKind `json:"kind,omitempty"`
	TitleMode TitleMode   `json:"titleMode,omitempty"`
}

// EffectiveKind returns Kind, defaulting an empty value to
// SectionKindChapter — the zero value for every chapter saved before this
// field existed.
func (c Chapter) EffectiveKind() SectionKind {
	if c.Kind == "" {
		return SectionKindChapter
	}
	return c.Kind
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
			fields["chapters"] = "each chapter must be at most 8MB of HTML"
			break
		}
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}
