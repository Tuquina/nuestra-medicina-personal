package toolentries

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/crypto"
)

type memoryRepository struct {
	keys    map[string]StoredKey
	entries map[string]StoredEntry
	count   map[string]int // overrides CountEntries per user|tool when set
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{keys: map[string]StoredKey{}, entries: map[string]StoredEntry{}, count: map[string]int{}}
}

func entryID(userID string, ref toolentry.Ref) string {
	return userID + "|" + ref.Tool + "|" + ref.Kind + "|" + ref.Key
}

func (r *memoryRepository) GetDataKey(_ context.Context, userID string) (StoredKey, error) {
	key, ok := r.keys[userID]
	if !ok {
		return StoredKey{}, toolentry.ErrNotFound
	}
	return key, nil
}

func (r *memoryRepository) InsertDataKey(_ context.Context, userID string, key StoredKey) (StoredKey, error) {
	if existing, ok := r.keys[userID]; ok {
		return existing, nil
	}
	r.keys[userID] = key
	return key, nil
}

func (r *memoryRepository) ListEntries(_ context.Context, userID, tool string, after *toolentry.Cursor, limit int) ([]StoredEntry, error) {
	var rows []StoredEntry
	for _, entry := range r.entries {
		if entry.UserID != userID || entry.Tool != tool {
			continue
		}
		if after != nil && (entry.Kind < after.Kind || (entry.Kind == after.Kind && entry.Key <= after.Key)) {
			continue
		}
		rows = append(rows, entry)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Kind != rows[j].Kind {
			return rows[i].Kind < rows[j].Kind
		}
		return rows[i].Key < rows[j].Key
	})
	if len(rows) > limit {
		rows = rows[:limit]
	}
	return rows, nil
}

func (r *memoryRepository) CountEntries(_ context.Context, userID, tool string) (int, error) {
	if override, ok := r.count[userID+"|"+tool]; ok {
		return override, nil
	}
	total := 0
	for _, entry := range r.entries {
		if entry.UserID == userID && entry.Tool == tool {
			total++
		}
	}
	return total, nil
}

func (r *memoryRepository) HasEntry(_ context.Context, userID string, ref toolentry.Ref) (bool, error) {
	_, ok := r.entries[entryID(userID, ref)]
	return ok, nil
}

func (r *memoryRepository) UpsertEntry(_ context.Context, entry StoredEntry) (StoredEntry, error) {
	if existing, ok := r.entries[entryID(entry.UserID, entry.Ref)]; ok && existing.Revision > entry.Revision {
		return StoredEntry{}, toolentry.ErrStaleRevision
	}
	id := entryID(entry.UserID, entry.Ref)
	if existing, ok := r.entries[id]; ok {
		entry.CreatedAt = existing.CreatedAt
	}
	r.entries[id] = entry
	return entry, nil
}

func (r *memoryRepository) DeleteEntry(_ context.Context, userID string, ref toolentry.Ref) error {
	delete(r.entries, entryID(userID, ref))
	return nil
}

func (r *memoryRepository) DeleteTool(_ context.Context, userID, tool, kind string) error {
	for id, entry := range r.entries {
		if entry.UserID == userID && entry.Tool == tool && (kind == "" || entry.Kind == kind) {
			delete(r.entries, id)
		}
	}
	return nil
}

func newTestService(t *testing.T) (*Service, *memoryRepository) {
	t.Helper()
	envelope, err := crypto.NewEnvelope(bytes.Repeat([]byte{9}, crypto.KeySize), 1)
	if err != nil {
		t.Fatal(err)
	}
	repository := newMemoryRepository()
	return NewService(repository, envelope), repository
}

func dayRef(date string) toolentry.Ref {
	return toolentry.Ref{Tool: "escritura-diaria", Kind: "day", Key: date}
}

func TestDisabledServiceRefusesEveryOperation(t *testing.T) {
	service := NewService(newMemoryRepository(), nil)
	ctx := context.Background()
	if service.Enabled() {
		t.Fatal("expected a service without encryptor to be disabled")
	}
	checks := []error{
		func() error { _, err := service.List(ctx, "u", "preguntas", nil, 0); return err }(),
		func() error {
			_, err := service.Put(ctx, "u", dayRef("2026-11-13"), json.RawMessage(`{}`), 0)
			return err
		}(),
		service.Delete(ctx, "u", dayRef("2026-11-13")),
		service.DeleteAll(ctx, "u", "preguntas", ""),
	}
	for _, err := range checks {
		if !errors.Is(err, toolentry.ErrStorageUnavailable) {
			t.Fatalf("expected ErrStorageUnavailable, got %v", err)
		}
	}
}

func TestPutStoresOnlyCiphertextAndListDecrypts(t *testing.T) {
	service, repository := newTestService(t)
	ctx := context.Background()
	data := json.RawMessage(`{"text":"hoy me siento en calma","mood":"Calma"}`)

	saved, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), data, 1)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if saved.CreatedAt.IsZero() || saved.UpdatedAt.IsZero() {
		t.Fatal("expected timestamps on the saved entry")
	}
	for _, stored := range repository.entries {
		if bytes.Contains(stored.Ciphertext, []byte("calma")) {
			t.Fatal("stored ciphertext must not contain the plaintext")
		}
	}
	if bytes.Contains(repository.keys["user-a"].Wrapped, []byte("calma")) || len(repository.keys) != 1 {
		t.Fatal("expected exactly one wrapped data key for the user")
	}

	page, err := service.List(ctx, "user-a", "escritura-diaria", nil, 0)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(page.Entries) != 1 || string(page.Entries[0].Data) != string(data) || page.Next != nil {
		t.Fatalf("unexpected page %+v", page)
	}
}

func TestEntriesAreIsolatedPerUser(t *testing.T) {
	service, repository := newTestService(t)
	ctx := context.Background()
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"privado"}`), 0); err != nil {
		t.Fatal(err)
	}

	page, err := service.List(ctx, "user-b", "escritura-diaria", nil, 0)
	if err != nil || len(page.Entries) != 0 {
		t.Fatalf("expected user-b to see nothing, got %+v %v", page, err)
	}

	// Even if a row were copied into another account, it must not decrypt there.
	if _, err := service.Put(ctx, "user-b", dayRef("2026-11-01"), json.RawMessage(`{"text":"mío"}`), 0); err != nil {
		t.Fatal(err)
	}
	stolen := repository.entries[entryID("user-a", dayRef("2026-11-13"))]
	stolen.UserID = "user-b"
	repository.entries[entryID("user-b", dayRef("2026-11-13"))] = stolen
	if _, err := service.List(ctx, "user-b", "escritura-diaria", nil, 0); !errors.Is(err, crypto.ErrDecrypt) {
		t.Fatalf("expected a copied row to fail decryption, got %v", err)
	}
}

func TestPutReplacesAndKeepsCreatedAt(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()
	first, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"uno"}`), 0)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"dos"}`), 0)
	if err != nil {
		t.Fatal(err)
	}
	if !second.CreatedAt.Equal(first.CreatedAt) {
		t.Fatal("replacing an entry must keep its creation time")
	}
	page, _ := service.List(ctx, "user-a", "escritura-diaria", nil, 0)
	if len(page.Entries) != 1 || string(page.Entries[0].Data) != `{"text":"dos"}` {
		t.Fatalf("expected the replaced content, got %+v", page.Entries)
	}
}

func TestListPaginatesWithACursor(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()
	for day := 1; day <= 5; day++ {
		if _, err := service.Put(ctx, "user-a", dayRef(fmt.Sprintf("2026-11-%02d", day)), json.RawMessage(`{}`), 1); err != nil {
			t.Fatal(err)
		}
	}

	var keys []string
	var cursor *toolentry.Cursor
	for pages := 0; pages < 10; pages++ {
		page, err := service.List(ctx, "user-a", "escritura-diaria", cursor, 2)
		if err != nil {
			t.Fatal(err)
		}
		for _, entry := range page.Entries {
			keys = append(keys, entry.Key)
		}
		if page.Next == nil {
			break
		}
		cursor = page.Next
	}
	if fmt.Sprint(keys) != "[2026-11-01 2026-11-02 2026-11-03 2026-11-04 2026-11-05]" {
		t.Fatalf("unexpected paginated keys %v", keys)
	}
}

func TestPutEnforcesThePerToolCapOnlyForNewEntries(t *testing.T) {
	service, repository := newTestService(t)
	ctx := context.Background()
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{}`), 0); err != nil {
		t.Fatal(err)
	}
	repository.count["user-a|escritura-diaria"] = toolentry.MaxEntriesPerTool

	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-14"), json.RawMessage(`{}`), 0); !errors.Is(err, toolentry.ErrTooManyEntries) {
		t.Fatalf("expected ErrTooManyEntries for a new entry, got %v", err)
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"editado"}`), 0); err != nil {
		t.Fatalf("expected an existing entry to stay editable at the cap: %v", err)
	}
}

func TestDeleteAndDeleteAll(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()
	answer := toolentry.Ref{Tool: "preguntas", Kind: "answer", Key: "a1"}
	favorites := toolentry.Ref{Tool: "preguntas", Kind: "favorites", Key: "all"}
	for _, ref := range []toolentry.Ref{answer, favorites} {
		if _, err := service.Put(ctx, "user-a", ref, json.RawMessage(`{}`), 0); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{}`), 0); err != nil {
		t.Fatal(err)
	}

	if err := service.Delete(ctx, "user-a", answer); err != nil {
		t.Fatal(err)
	}
	if err := service.Delete(ctx, "user-a", answer); err != nil {
		t.Fatalf("deleting a missing entry must be a no-op: %v", err)
	}
	page, _ := service.List(ctx, "user-a", "preguntas", nil, 0)
	if len(page.Entries) != 1 || page.Entries[0].Kind != "favorites" {
		t.Fatalf("unexpected entries after delete: %+v", page.Entries)
	}

	if _, err := service.Put(ctx, "user-a", answer, json.RawMessage(`{}`), 0); err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteAll(ctx, "user-a", "preguntas", "answer"); err != nil {
		t.Fatal(err)
	}
	page, _ = service.List(ctx, "user-a", "preguntas", nil, 0)
	if len(page.Entries) != 1 || page.Entries[0].Kind != "favorites" {
		t.Fatalf("deleting one kind must keep the others, got %+v", page.Entries)
	}
	var validation *toolentry.ValidationError
	if err := service.DeleteAll(ctx, "user-a", "preguntas", "day"); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for a kind the tool doesn't store, got %v", err)
	}

	if err := service.DeleteAll(ctx, "user-a", "preguntas", ""); err != nil {
		t.Fatal(err)
	}
	page, _ = service.List(ctx, "user-a", "preguntas", nil, 0)
	other, _ := service.List(ctx, "user-a", "escritura-diaria", nil, 0)
	if len(page.Entries) != 0 || len(other.Entries) != 1 {
		t.Fatal("DeleteAll must only clear the given tool")
	}
}

func TestInvalidInputIsRejected(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()
	var validation *toolentry.ValidationError
	if _, err := service.Put(ctx, "user-a", toolentry.Ref{Tool: "preguntas", Kind: "day", Key: "x"}, json.RawMessage(`{}`), 1); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for a wrong kind, got %v", err)
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`[]`), 0); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for non-object data, got %v", err)
	}
	if _, err := service.List(ctx, "user-a", "desconocida", nil, 0); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for an unknown tool, got %v", err)
	}
}

func TestPutRejectsAnOlderRevision(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"nuevo"}`), 20); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"viejo"}`), 19); !errors.Is(err, toolentry.ErrStaleRevision) {
		t.Fatalf("expected ErrStaleRevision, got %v", err)
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-13"), json.RawMessage(`{"text":"nuevo"}`), 20); err != nil {
		t.Fatalf("retrying the same revision must be idempotent: %v", err)
	}
	page, _ := service.List(ctx, "user-a", "escritura-diaria", nil, 0)
	if len(page.Entries) != 1 || string(page.Entries[0].Data) != `{"text":"nuevo"}` {
		t.Fatalf("expected the newer writing to stay, got %+v", page.Entries)
	}
	if _, err := service.Put(ctx, "user-a", dayRef("2026-11-14"), json.RawMessage(`{}`), -1); err == nil {
		t.Fatal("expected a negative revision to be rejected")
	}
}
