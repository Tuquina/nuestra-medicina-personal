package postgres

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

type AuthRepository struct {
	pool *pgxpool.Pool
}

func NewAuthRepository(pool *pgxpool.Pool) *AuthRepository { return &AuthRepository{pool: pool} }

func (r *AuthRepository) CreateSession(ctx context.Context, identity auth.Identity, session auth.Session, now time.Time) (auth.User, error) {
	userID, err := databaseUUID()
	if err != nil {
		return auth.User{}, fmt.Errorf("generate user id: %w", err)
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return auth.User{}, fmt.Errorf("begin authentication transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user auth.User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (id, google_subject, email, display_name, picture_url, created_at, last_login_at)
		VALUES ($1::uuid, $2, $3, $4, NULLIF($5, ''), $6, $6)
		ON CONFLICT (google_subject) DO UPDATE SET
			email = EXCLUDED.email,
			display_name = EXCLUDED.display_name,
			picture_url = EXCLUDED.picture_url,
			last_login_at = EXCLUDED.last_login_at
		RETURNING id::text, email, display_name, COALESCE(picture_url, ''), created_at, last_login_at`,
		userID, identity.GoogleSubject, identity.Email, identity.DisplayName, identity.PictureURL, now,
	).Scan(&user.ID, &user.Email, &user.DisplayName, &user.PictureURL, &user.CreatedAt, &user.LastLoginAt)
	if err != nil {
		return auth.User{}, fmt.Errorf("upsert authenticated user: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
		session.ID, user.ID, session.TokenHash, now, session.ExpiresAt,
	); err != nil {
		return auth.User{}, fmt.Errorf("insert session: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return auth.User{}, fmt.Errorf("commit authentication transaction: %w", err)
	}
	return user, nil
}

func (r *AuthRepository) GetUserByTokenHash(ctx context.Context, tokenHash, adminGoogleSub string) (auth.User, error) {
	var user auth.User
	var googleSubject string
	err := r.pool.QueryRow(ctx, `
		SELECT users.id::text, users.google_subject, users.email, users.display_name,
		       COALESCE(users.picture_url, ''), users.created_at, users.last_login_at
		FROM sessions
		JOIN users ON users.id = sessions.user_id
		WHERE sessions.token_hash = $1
		  AND sessions.expires_at > now()
		  AND sessions.revoked_at IS NULL
		  AND users.deleted_at IS NULL`, tokenHash,
	).Scan(&user.ID, &googleSubject, &user.Email, &user.DisplayName, &user.PictureURL, &user.CreatedAt, &user.LastLoginAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, auth.ErrUnauthorized
	}
	if err != nil {
		return auth.User{}, fmt.Errorf("get session user: %w", err)
	}
	user.IsAdmin = adminGoogleSub != "" && googleSubject == adminGoogleSub
	return user, nil
}

func (r *AuthRepository) RevokeSession(ctx context.Context, tokenHash string, now time.Time) error {
	if _, err := r.pool.Exec(ctx, `
		UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2)
		WHERE token_hash = $1`, tokenHash, now); err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

// DeleteAccount anonymizes the user row (soft-delete, per ADR — orders,
// payments and reviews keep their FK to preserve historical/accounting
// integrity) and revokes every session, so the deletion takes effect
// immediately even if the caller's own cookie somehow survives the request.
// google_subject is rewritten too, freeing its UNIQUE constraint so a future
// login with the same Google account creates a fresh user instead of
// colliding with the anonymized row.
func (r *AuthRepository) DeleteAccount(ctx context.Context, userID string, now time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin account deletion transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tag, err := tx.Exec(ctx, `
		UPDATE users SET
			email = 'deleted+' || id::text || '@deleted.local',
			display_name = 'Cuenta eliminada',
			picture_url = NULL,
			google_subject = 'deleted:' || id::text,
			deleted_at = $2
		WHERE id = $1::uuid AND deleted_at IS NULL`, userID, now)
	if err != nil {
		return fmt.Errorf("anonymize user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return auth.ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `
		UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2)
		WHERE user_id = $1::uuid AND revoked_at IS NULL`, userID, now); err != nil {
		return fmt.Errorf("revoke sessions on account deletion: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit account deletion: %w", err)
	}
	return nil
}

func databaseUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
