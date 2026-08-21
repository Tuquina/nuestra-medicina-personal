package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

type SessionAuthorizer struct {
	pool            *pgxpool.Pool
	adminGoogleSubs []string
}

func NewSessionAuthorizer(pool *pgxpool.Pool, adminGoogleSubs []string) *SessionAuthorizer {
	return &SessionAuthorizer{pool: pool, adminGoogleSubs: adminGoogleSubs}
}

func (a *SessionAuthorizer) AuthorizeAdmin(ctx context.Context, rawToken string) (string, error) {
	if rawToken == "" || len(a.adminGoogleSubs) == 0 {
		return "", auth.ErrUnauthorized
	}
	digest := sha256.Sum256([]byte(rawToken))
	var userID string
	err := a.pool.QueryRow(ctx, `
		SELECT users.id::text
		FROM sessions
		JOIN users ON users.id = sessions.user_id
		WHERE sessions.token_hash = $1
		  AND sessions.expires_at > now()
		  AND sessions.revoked_at IS NULL
		  AND users.google_subject = ANY($2)`, hex.EncodeToString(digest[:]), a.adminGoogleSubs).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", auth.ErrUnauthorized
	}
	if err != nil {
		return "", fmt.Errorf("authorize admin session: %w", err)
	}
	return userID, nil
}
