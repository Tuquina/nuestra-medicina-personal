package postgres

import (
	"context"
	"fmt"

	"github.com/nuestra-medicina-personal/backend/internal/domain/page"
)

// maxListedPages bounds one listing; meditations are counted in dozens.
const maxListedPages = 500

// ListByType returns the pages of one type, oldest first. With
// publishedOnly it returns only pages with published content.
func (r *PageRepository) ListByType(ctx context.Context, pageType string, publishedOnly bool) ([]page.Page, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+pageColumns+`
		FROM pages
		WHERE type = $1
		  AND (NOT $2 OR (status = 'PUBLISHED' AND published_content IS NOT NULL))
		ORDER BY created_at, slug
		LIMIT $3`, pageType, publishedOnly, maxListedPages)
	if err != nil {
		return nil, fmt.Errorf("list pages: %w", err)
	}
	defer rows.Close()
	pages := []page.Page{}
	for rows.Next() {
		value, err := scanPage(rows)
		if err != nil {
			return nil, err
		}
		pages = append(pages, value)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pages: %w", err)
	}
	return pages, nil
}
