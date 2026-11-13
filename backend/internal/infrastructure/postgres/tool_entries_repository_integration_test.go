//go:build integration

package postgres

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/application/toolentries"
	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/crypto"
)

func TestToolEntriesAreEncryptedPaginatedAndDeletedWithTheAccount(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const userID = "10000000-0000-4000-8000-000000000060"
	const otherUserID = "10000000-0000-4000-8000-000000000061"
	cleanup := func() {
		for _, id := range []string{userID, otherUserID} {
			_, _ = pool.Exec(ctx, `DELETE FROM tool_entries WHERE user_id = $1::uuid`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM user_data_keys WHERE user_id = $1::uuid`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1::uuid`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, id)
		}
	}
	cleanup()
	t.Cleanup(cleanup)
	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, google_subject, email, display_name) VALUES
		($1::uuid, 'tools-owner', 'tools-owner@example.com', 'Owner'),
		($2::uuid, 'tools-other', 'tools-other@example.com', 'Other')`, userID, otherUserID); err != nil {
		t.Fatalf("seed users: %v", err)
	}

	envelope, err := crypto.NewEnvelope(bytes.Repeat([]byte{3}, crypto.KeySize), 1)
	if err != nil {
		t.Fatal(err)
	}
	repository := NewToolEntriesRepository(pool)
	service := toolentries.NewService(repository, envelope)

	// Save five days, then replace one, and confirm only ciphertext is stored.
	for day := 1; day <= 5; day++ {
		ref := toolentry.Ref{Tool: "escritura-diaria", Kind: "day", Key: fmt.Sprintf("2026-11-%02d", day)}
		if _, err := service.Put(ctx, userID, ref, json.RawMessage(fmt.Sprintf(`{"text":"secreto %d"}`, day))); err != nil {
			t.Fatalf("put day %d: %v", day, err)
		}
	}
	first, err := service.Put(ctx, userID, toolentry.Ref{Tool: "escritura-diaria", Kind: "day", Key: "2026-11-03"}, json.RawMessage(`{"text":"editado"}`))
	if err != nil {
		t.Fatal(err)
	}
	var leaked int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM tool_entries WHERE user_id = $1::uuid AND position('secreto' in encode(ciphertext, 'escape')) > 0`, userID,
	).Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("expected no plaintext in the database, found %d (err %v)", leaked, err)
	}

	// Paginate through everything with a small page size.
	var texts []string
	var cursor *toolentry.Cursor
	for pages := 0; pages < 10; pages++ {
		page, err := service.List(ctx, userID, "escritura-diaria", cursor, 2)
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		for _, entry := range page.Entries {
			texts = append(texts, string(entry.Data))
		}
		if page.Next == nil {
			break
		}
		cursor = page.Next
	}
	if len(texts) != 5 || texts[2] != `{"text":"editado"}` {
		t.Fatalf("unexpected entries %v", texts)
	}
	if first.CreatedAt.After(first.UpdatedAt) {
		t.Fatal("created_at must not be after updated_at")
	}

	// Another account sees nothing.
	other, err := service.List(ctx, otherUserID, "escritura-diaria", nil, 0)
	if err != nil || len(other.Entries) != 0 {
		t.Fatalf("expected the other user to see nothing, got %+v %v", other, err)
	}

	// Deleting the account removes the entries and the data key.
	if err := NewAuthRepository(pool).DeleteAccount(ctx, userID, time.Now().UTC()); err != nil {
		t.Fatalf("delete account: %v", err)
	}
	var entries, keys int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM tool_entries WHERE user_id = $1::uuid`, userID).Scan(&entries)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM user_data_keys WHERE user_id = $1::uuid`, userID).Scan(&keys)
	if entries != 0 || keys != 0 {
		t.Fatalf("expected account deletion to remove entries and key, found %d entries and %d keys", entries, keys)
	}
}
