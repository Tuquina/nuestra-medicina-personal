// Package toolentries stores what a signed-in person writes in the
// Herramientas tools, encrypted with that person's own data key (ADR 0006).
// Plaintext only exists in memory while a request is being served.
package toolentries

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
)

// FormatVersion identifies how an entry's ciphertext was produced, so a
// future scheme (e.g. client-side encryption) can coexist with this one.
const FormatVersion int16 = 1

// StoredKey is a user's data key as persisted: wrapped by the master key.
type StoredKey struct {
	Wrapped    []byte
	KEKVersion int16
}

// StoredEntry is an entry as persisted: encrypted.
type StoredEntry struct {
	ID     string
	UserID string
	toolentry.Ref
	Ciphertext    []byte
	FormatVersion int16
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Repository interface {
	// GetDataKey returns toolentry.ErrNotFound when the user has none yet.
	GetDataKey(ctx context.Context, userID string) (StoredKey, error)
	// InsertDataKey stores key unless the user already has one, and
	// returns whichever key is stored (so concurrent first saves agree).
	InsertDataKey(ctx context.Context, userID string, key StoredKey) (StoredKey, error)
	// ListEntries returns up to limit entries of one tool, ordered by
	// (kind, key), strictly after the cursor when one is given.
	ListEntries(ctx context.Context, userID, tool string, after *toolentry.Cursor, limit int) ([]StoredEntry, error)
	CountEntries(ctx context.Context, userID, tool string) (int, error)
	HasEntry(ctx context.Context, userID string, ref toolentry.Ref) (bool, error)
	// UpsertEntry inserts or replaces the entry at entry.Ref, keeping the
	// original CreatedAt on replace, and returns what was stored.
	UpsertEntry(ctx context.Context, entry StoredEntry) (StoredEntry, error)
	DeleteEntry(ctx context.Context, userID string, ref toolentry.Ref) error
	// DeleteTool removes the user's entries of one tool; kind narrows it when not empty.
	DeleteTool(ctx context.Context, userID, tool, kind string) error
}

// Encryptor is implemented by infrastructure/crypto.Envelope.
type Encryptor interface {
	KeyVersion() int16
	NewDataKey() ([]byte, error)
	WrapDataKey(ownerID string, dataKey []byte) ([]byte, error)
	UnwrapDataKey(ownerID string, wrapped []byte, version int16) ([]byte, error)
	Seal(dataKey, plaintext, aad []byte) ([]byte, error)
	Open(dataKey, ciphertext, aad []byte) ([]byte, error)
}

// Page is one listing page; Next is nil on the last page.
type Page struct {
	Entries []toolentry.Entry
	Next    *toolentry.Cursor
}

type Service struct {
	repository Repository
	encryptor  Encryptor
	now        func() time.Time
	newID      func() (string, error)
}

// NewService builds the service. A nil encryptor (no PERSONAL_DATA_KEY)
// disables account storage: every call returns ErrStorageUnavailable.
func NewService(repository Repository, encryptor Encryptor) *Service {
	return &Service{repository: repository, encryptor: encryptor, now: time.Now, newID: randomUUID}
}

// Enabled reports whether account storage is configured.
func (s *Service) Enabled() bool { return s.encryptor != nil }

// List returns one page of the user's entries for a tool, decrypted.
func (s *Service) List(ctx context.Context, userID, tool string, after *toolentry.Cursor, limit int) (Page, error) {
	if !s.Enabled() {
		return Page{}, toolentry.ErrStorageUnavailable
	}
	if err := toolentry.ValidateTool(tool); err != nil {
		return Page{}, err
	}
	if limit < 1 {
		limit = toolentry.DefaultPageSize
	}
	limit = min(limit, toolentry.MaxPageSize)

	dataKey, err := s.dataKey(ctx, userID, false)
	if errors.Is(err, toolentry.ErrNotFound) {
		return Page{Entries: []toolentry.Entry{}}, nil
	}
	if err != nil {
		return Page{}, err
	}
	rows, err := s.repository.ListEntries(ctx, userID, tool, after, limit+1)
	if err != nil {
		return Page{}, fmt.Errorf("list tool entries: %w", err)
	}

	page := Page{Entries: make([]toolentry.Entry, 0, min(len(rows), limit))}
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		page.Next = &toolentry.Cursor{Kind: last.Kind, Key: last.Key}
	}
	for _, row := range rows {
		plaintext, err := s.encryptor.Open(dataKey, row.Ciphertext, toolentry.AssociatedData(userID, row.Ref))
		if err != nil {
			return Page{}, fmt.Errorf("decrypt tool entry %s: %w", row.ID, err)
		}
		page.Entries = append(page.Entries, toolentry.Entry{
			Ref: row.Ref, Data: json.RawMessage(plaintext), CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		})
	}
	return page, nil
}

// Put creates or replaces one entry, encrypting data with the user's key.
func (s *Service) Put(ctx context.Context, userID string, ref toolentry.Ref, data json.RawMessage) (toolentry.Entry, error) {
	if !s.Enabled() {
		return toolentry.Entry{}, toolentry.ErrStorageUnavailable
	}
	if err := ref.Validate(); err != nil {
		return toolentry.Entry{}, err
	}
	if err := toolentry.ValidateData(data); err != nil {
		return toolentry.Entry{}, err
	}
	if err := s.ensureCapacity(ctx, userID, ref); err != nil {
		return toolentry.Entry{}, err
	}

	dataKey, err := s.dataKey(ctx, userID, true)
	if err != nil {
		return toolentry.Entry{}, err
	}
	ciphertext, err := s.encryptor.Seal(dataKey, data, toolentry.AssociatedData(userID, ref))
	if err != nil {
		return toolentry.Entry{}, fmt.Errorf("encrypt tool entry: %w", err)
	}
	id, err := s.newID()
	if err != nil {
		return toolentry.Entry{}, fmt.Errorf("generate tool entry id: %w", err)
	}
	now := s.now().UTC()
	stored, err := s.repository.UpsertEntry(ctx, StoredEntry{
		ID: id, UserID: userID, Ref: ref, Ciphertext: ciphertext,
		FormatVersion: FormatVersion, CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		return toolentry.Entry{}, fmt.Errorf("save tool entry: %w", err)
	}
	return toolentry.Entry{Ref: ref, Data: data, CreatedAt: stored.CreatedAt, UpdatedAt: stored.UpdatedAt}, nil
}

// Delete removes one entry. Deleting a missing entry is not an error.
func (s *Service) Delete(ctx context.Context, userID string, ref toolentry.Ref) error {
	if !s.Enabled() {
		return toolentry.ErrStorageUnavailable
	}
	if err := ref.Validate(); err != nil {
		return err
	}
	if err := s.repository.DeleteEntry(ctx, userID, ref); err != nil {
		return fmt.Errorf("delete tool entry: %w", err)
	}
	return nil
}

// DeleteAll removes every entry the user has in one tool, or only those
// of one kind when kind is not empty.
func (s *Service) DeleteAll(ctx context.Context, userID, tool, kind string) error {
	if !s.Enabled() {
		return toolentry.ErrStorageUnavailable
	}
	if err := toolentry.ValidateTool(tool); err != nil {
		return err
	}
	if kind != "" {
		if err := toolentry.ValidateKind(tool, kind); err != nil {
			return err
		}
	}
	if err := s.repository.DeleteTool(ctx, userID, tool, kind); err != nil {
		return fmt.Errorf("delete tool entries: %w", err)
	}
	return nil
}

// ensureCapacity rejects a *new* entry once the tool is full; replacing an
// existing entry is always allowed.
func (s *Service) ensureCapacity(ctx context.Context, userID string, ref toolentry.Ref) error {
	count, err := s.repository.CountEntries(ctx, userID, ref.Tool)
	if err != nil {
		return fmt.Errorf("count tool entries: %w", err)
	}
	if count < toolentry.MaxEntriesPerTool {
		return nil
	}
	exists, err := s.repository.HasEntry(ctx, userID, ref)
	if err != nil {
		return fmt.Errorf("check tool entry: %w", err)
	}
	if !exists {
		return toolentry.ErrTooManyEntries
	}
	return nil
}

// dataKey returns the user's unwrapped data key, creating one on first use
// when create is true (otherwise a missing key is toolentry.ErrNotFound).
func (s *Service) dataKey(ctx context.Context, userID string, create bool) ([]byte, error) {
	stored, err := s.repository.GetDataKey(ctx, userID)
	if errors.Is(err, toolentry.ErrNotFound) && create {
		stored, err = s.createDataKey(ctx, userID)
	}
	if err != nil {
		if errors.Is(err, toolentry.ErrNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("load data key: %w", err)
	}
	key, err := s.encryptor.UnwrapDataKey(userID, stored.Wrapped, stored.KEKVersion)
	if err != nil {
		return nil, fmt.Errorf("unwrap data key: %w", err)
	}
	return key, nil
}

func (s *Service) createDataKey(ctx context.Context, userID string) (StoredKey, error) {
	dataKey, err := s.encryptor.NewDataKey()
	if err != nil {
		return StoredKey{}, err
	}
	wrapped, err := s.encryptor.WrapDataKey(userID, dataKey)
	if err != nil {
		return StoredKey{}, fmt.Errorf("wrap data key: %w", err)
	}
	return s.repository.InsertDataKey(ctx, userID, StoredKey{Wrapped: wrapped, KEKVersion: s.encryptor.KeyVersion()})
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
