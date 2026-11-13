package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/application/toolentries"
	"github.com/nuestra-medicina-personal/backend/internal/domain/toolentry"
)

const toolEntryColumns = `id::text, user_id::text, tool, kind, entry_key, ciphertext, format_version, created_at, updated_at`

// ToolEntriesRepository persists encrypted tool entries and wrapped data
// keys (migration 015, ADR 0006). It never sees plaintext.
type ToolEntriesRepository struct{ pool *pgxpool.Pool }

func NewToolEntriesRepository(pool *pgxpool.Pool) *ToolEntriesRepository {
	return &ToolEntriesRepository{pool: pool}
}

func (r *ToolEntriesRepository) GetDataKey(ctx context.Context, userID string) (toolentries.StoredKey, error) {
	var key toolentries.StoredKey
	err := r.pool.QueryRow(ctx,
		`SELECT wrapped_key, kek_version FROM user_data_keys WHERE user_id = $1::uuid`, userID,
	).Scan(&key.Wrapped, &key.KEKVersion)
	if errors.Is(err, pgx.ErrNoRows) {
		return toolentries.StoredKey{}, toolentry.ErrNotFound
	}
	if err != nil {
		return toolentries.StoredKey{}, fmt.Errorf("get data key: %w", err)
	}
	return key, nil
}

func (r *ToolEntriesRepository) InsertDataKey(ctx context.Context, userID string, key toolentries.StoredKey) (toolentries.StoredKey, error) {
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO user_data_keys (user_id, wrapped_key, kek_version)
		VALUES ($1::uuid, $2, $3)
		ON CONFLICT (user_id) DO NOTHING`, userID, key.Wrapped, key.KEKVersion); err != nil {
		return toolentries.StoredKey{}, fmt.Errorf("insert data key: %w", err)
	}
	// Read back: if a concurrent request created the key first, use that one.
	return r.GetDataKey(ctx, userID)
}

func (r *ToolEntriesRepository) ListEntries(ctx context.Context, userID, tool string, after *toolentry.Cursor, limit int) ([]toolentries.StoredEntry, error) {
	afterKind, afterKey := "", ""
	if after != nil {
		afterKind, afterKey = after.Kind, after.Key
	}
	rows, err := r.pool.Query(ctx, `
		SELECT `+toolEntryColumns+`
		FROM tool_entries
		WHERE user_id = $1::uuid AND tool = $2 AND (kind, entry_key) > ($3, $4)
		ORDER BY kind, entry_key
		LIMIT $5`, userID, tool, afterKind, afterKey, limit)
	if err != nil {
		return nil, fmt.Errorf("list tool entries: %w", err)
	}
	defer rows.Close()
	var entries []toolentries.StoredEntry
	for rows.Next() {
		entry, err := scanToolEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tool entries: %w", err)
	}
	return entries, nil
}

func (r *ToolEntriesRepository) CountEntries(ctx context.Context, userID, tool string) (int, error) {
	var count int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM tool_entries WHERE user_id = $1::uuid AND tool = $2`, userID, tool,
	).Scan(&count); err != nil {
		return 0, fmt.Errorf("count tool entries: %w", err)
	}
	return count, nil
}

func (r *ToolEntriesRepository) HasEntry(ctx context.Context, userID string, ref toolentry.Ref) (bool, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM tool_entries
			WHERE user_id = $1::uuid AND tool = $2 AND kind = $3 AND entry_key = $4
		)`, userID, ref.Tool, ref.Kind, ref.Key,
	).Scan(&exists); err != nil {
		return false, fmt.Errorf("check tool entry: %w", err)
	}
	return exists, nil
}

func (r *ToolEntriesRepository) UpsertEntry(ctx context.Context, entry toolentries.StoredEntry) (toolentries.StoredEntry, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO tool_entries (id, user_id, tool, kind, entry_key, ciphertext, format_version, created_at, updated_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT ON CONSTRAINT tool_entries_user_entry_key DO UPDATE SET
			ciphertext = EXCLUDED.ciphertext,
			format_version = EXCLUDED.format_version,
			updated_at = EXCLUDED.updated_at
		RETURNING `+toolEntryColumns,
		entry.ID, entry.UserID, entry.Tool, entry.Kind, entry.Key, entry.Ciphertext, entry.FormatVersion, entry.CreatedAt, entry.UpdatedAt,
	)
	stored, err := scanToolEntry(row)
	if err != nil {
		return toolentries.StoredEntry{}, fmt.Errorf("upsert tool entry: %w", err)
	}
	return stored, nil
}

func (r *ToolEntriesRepository) DeleteEntry(ctx context.Context, userID string, ref toolentry.Ref) error {
	if _, err := r.pool.Exec(ctx, `
		DELETE FROM tool_entries
		WHERE user_id = $1::uuid AND tool = $2 AND kind = $3 AND entry_key = $4`,
		userID, ref.Tool, ref.Kind, ref.Key); err != nil {
		return fmt.Errorf("delete tool entry: %w", err)
	}
	return nil
}

func (r *ToolEntriesRepository) DeleteTool(ctx context.Context, userID, tool string) error {
	if _, err := r.pool.Exec(ctx,
		`DELETE FROM tool_entries WHERE user_id = $1::uuid AND tool = $2`, userID, tool); err != nil {
		return fmt.Errorf("delete tool entries: %w", err)
	}
	return nil
}

func scanToolEntry(row pgx.Row) (toolentries.StoredEntry, error) {
	var entry toolentries.StoredEntry
	err := row.Scan(&entry.ID, &entry.UserID, &entry.Tool, &entry.Kind, &entry.Key,
		&entry.Ciphertext, &entry.FormatVersion, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return toolentries.StoredEntry{}, fmt.Errorf("scan tool entry: %w", err)
	}
	return entry, nil
}
