package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

type ManuscriptRepository struct{ pool *pgxpool.Pool }

func NewManuscriptRepository(pool *pgxpool.Pool) *ManuscriptRepository {
	return &ManuscriptRepository{pool: pool}
}

func (r *ManuscriptRepository) Get(ctx context.Context, bookID string) (manuscript.Manuscript, error) {
	var chaptersJSON []byte
	var value manuscript.Manuscript
	err := r.pool.QueryRow(ctx, `SELECT book_id::text, chapters, updated_at FROM book_manuscripts WHERE book_id = $1::uuid`, bookID).
		Scan(&value.BookID, &chaptersJSON, &value.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return manuscript.Manuscript{}, manuscript.ErrNotFound
	}
	if err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("get manuscript: %w", err)
	}
	if err := json.Unmarshal(chaptersJSON, &value.Chapters); err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("decode manuscript chapters: %w", err)
	}
	return value, nil
}

func (r *ManuscriptRepository) Save(ctx context.Context, value manuscript.Manuscript) (manuscript.Manuscript, error) {
	chaptersJSON, err := json.Marshal(value.Chapters)
	if err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("encode manuscript chapters: %w", err)
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO book_manuscripts (book_id, chapters, updated_at)
		VALUES ($1::uuid, $2::jsonb, $3)
		ON CONFLICT (book_id) DO UPDATE SET chapters = EXCLUDED.chapters, updated_at = EXCLUDED.updated_at`,
		value.BookID, chaptersJSON, value.UpdatedAt,
	); err != nil {
		return manuscript.Manuscript{}, fmt.Errorf("save manuscript: %w", err)
	}
	return value, nil
}
