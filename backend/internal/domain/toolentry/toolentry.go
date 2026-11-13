// Package toolentry models what a signed-in person writes in the
// Herramientas tools. Each entry is identified by (tool, kind, key) within
// its owner's account; the content is an opaque JSON object that the
// application layer encrypts before it reaches the database (ADR 0006).
package toolentry

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
)

const (
	// MaxDataBytes caps one entry's JSON content (about 20,000 words).
	MaxDataBytes = 128 << 10
	// MaxEntriesPerTool caps how many entries one person keeps per tool —
	// years of daily writing, while bounding storage and listing cost.
	MaxEntriesPerTool = 5000
	// DefaultPageSize and MaxPageSize bound one listing page.
	DefaultPageSize = 200
	MaxPageSize     = 500
)

var (
	// ErrStorageUnavailable means account storage is not configured
	// (no PERSONAL_DATA_KEY) or not possible for this identity.
	ErrStorageUnavailable = errors.New("personal tool storage is unavailable")
	// ErrTooManyEntries is returned when creating an entry beyond MaxEntriesPerTool.
	ErrTooManyEntries = errors.New("too many entries for this tool")
	// ErrNotFound means the person has no such entry or no data key yet.
	ErrNotFound = errors.New("tool entry not found")
)

// kindsByTool is the allow-list of tools and the kinds of entry each one
// stores. Adding a tool or kind is a code change here, not a schema change.
var kindsByTool = map[string][]string{
	"escritura-diaria": {"day"},
	"preguntas":        {"answer", "favorites"},
	"cierre-semanal":   {"closure", "draft"},
}

var keyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Ref identifies one entry inside an account.
type Ref struct {
	Tool string
	Kind string
	Key  string
}

// Entry is one decrypted entry.
type Entry struct {
	Ref
	Data      json.RawMessage
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Cursor marks where a listing page ends: the (kind, key) of its last entry.
type Cursor struct {
	Kind string
	Key  string
}

// ValidationError lists every invalid field.
type ValidationError struct{ Fields map[string]string }

func (e *ValidationError) Error() string { return "tool entry is invalid" }

// ValidateKind checks that tool is known and stores entries of kind.
func ValidateKind(tool, kind string) error {
	if err := ValidateTool(tool); err != nil {
		return err
	}
	if !contains(kindsByTool[tool], kind) {
		return &ValidationError{Fields: map[string]string{"kind": "is not stored by this tool"}}
	}
	return nil
}

// ValidateTool checks that tool is a known tool.
func ValidateTool(tool string) error {
	if _, ok := kindsByTool[tool]; !ok {
		return &ValidationError{Fields: map[string]string{"tool": "is not a known tool"}}
	}
	return nil
}

// Validate checks that the ref names a known tool, a kind that tool
// stores, and a well-formed key.
func (r Ref) Validate() error {
	fields := make(map[string]string)
	kinds, ok := kindsByTool[r.Tool]
	switch {
	case !ok:
		fields["tool"] = "is not a known tool"
	case !contains(kinds, r.Kind):
		fields["kind"] = "is not stored by this tool"
	}
	if !keyPattern.MatchString(r.Key) {
		fields["key"] = "must be 1-64 letters, digits, '-' or '_'"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ValidateData checks that data is a single JSON object within MaxDataBytes.
func ValidateData(data json.RawMessage) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' || !json.Valid(trimmed) {
		return &ValidationError{Fields: map[string]string{"data": "must be a JSON object"}}
	}
	if len(trimmed) > MaxDataBytes {
		return &ValidationError{Fields: map[string]string{"data": "is too large"}}
	}
	return nil
}

// ParseCursor reads the "kind/key" form used in the API's cursor parameter.
func ParseCursor(tool, value string) (*Cursor, error) {
	if value == "" {
		return nil, nil
	}
	kind, key, ok := strings.Cut(value, "/")
	if !ok || (Ref{Tool: tool, Kind: kind, Key: key}).Validate() != nil {
		return nil, &ValidationError{Fields: map[string]string{"cursor": "is invalid"}}
	}
	return &Cursor{Kind: kind, Key: key}, nil
}

// String renders the cursor for the API.
func (c Cursor) String() string { return c.Kind + "/" + c.Key }

// AssociatedData binds a ciphertext to its owner and position, so a row
// copied to another user, tool, kind or key no longer decrypts.
func AssociatedData(ownerID string, ref Ref) []byte {
	return []byte("nmp:tool-entry:v1|" + ownerID + "|" + ref.Tool + "|" + ref.Kind + "|" + ref.Key)
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
