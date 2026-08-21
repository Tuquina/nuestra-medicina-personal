//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

func TestDeleteAccountAnonymizesUserAndRevokesSessions(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const userID = "10000000-0000-4000-8000-000000000020"
	cleanup := func() {
		_, _ = pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1::uuid`, userID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, google_subject, email, display_name)
		VALUES ($1::uuid, 'integration-delete-subject', 'delete-me@example.com', 'Delete Me')`, userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	tokenHash := "integration-delete-token-hash"
	if _, err := pool.Exec(ctx, `
		INSERT INTO sessions (id, user_id, token_hash, expires_at)
		VALUES (gen_random_uuid(), $1::uuid, $2, now() + interval '1 hour')`, userID, tokenHash); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	repository := NewAuthRepository(pool)
	now := time.Date(2026, 8, 21, 12, 0, 0, 0, time.UTC)
	if err := repository.DeleteAccount(ctx, userID, now); err != nil {
		t.Fatalf("delete account: %v", err)
	}

	var email, displayName, googleSubject string
	var deletedAt *time.Time
	if err := pool.QueryRow(ctx, `SELECT email, display_name, google_subject, deleted_at FROM users WHERE id = $1::uuid`, userID).
		Scan(&email, &displayName, &googleSubject, &deletedAt); err != nil {
		t.Fatalf("read anonymized user: %v", err)
	}
	if email != "deleted+"+userID+"@deleted.local" || displayName != "Cuenta eliminada" || googleSubject != "deleted:"+userID || deletedAt == nil {
		t.Fatalf("user was not anonymized: email=%q displayName=%q googleSubject=%q deletedAt=%v", email, displayName, googleSubject, deletedAt)
	}

	var revokedAt *time.Time
	if err := pool.QueryRow(ctx, `SELECT revoked_at FROM sessions WHERE token_hash = $1`, tokenHash).Scan(&revokedAt); err != nil {
		t.Fatalf("read session: %v", err)
	}
	if revokedAt == nil {
		t.Fatal("session was not revoked")
	}

	if _, err := repository.GetUserByTokenHash(ctx, tokenHash, ""); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("expected the revoked/deleted session to be unauthorized, got %v", err)
	}

	// Deleting an already-deleted account is a no-op error, not a panic or a
	// second anonymization pass.
	if err := repository.DeleteAccount(ctx, userID, now.Add(time.Minute)); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("expected repeat deletion to report unauthorized, got %v", err)
	}
}
