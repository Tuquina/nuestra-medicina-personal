package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

const settingsColumns = `
site_name, site_description, support_email, newsletter_email, sender_name,
seo_title, seo_description, seo_indexable, updated_at`

type SettingsRepository struct {
	pool *pgxpool.Pool
}

func NewSettingsRepository(pool *pgxpool.Pool) *SettingsRepository {
	return &SettingsRepository{pool: pool}
}

func (r *SettingsRepository) Get(ctx context.Context) (settingsdomain.Settings, error) {
	return scanSettings(r.pool.QueryRow(ctx, `SELECT `+settingsColumns+` FROM site_settings WHERE singleton`))
}

func (r *SettingsRepository) Update(ctx context.Context, value settingsdomain.Settings) (settingsdomain.Settings, error) {
	return scanSettings(r.pool.QueryRow(ctx, `
		UPDATE site_settings SET
			site_name = $1, site_description = $2, support_email = $3,
			newsletter_email = $4, sender_name = $5, seo_title = $6,
			seo_description = $7, seo_indexable = $8, updated_at = $9
		WHERE singleton
		RETURNING `+settingsColumns,
		value.SiteName, value.SiteDescription, value.SupportEmail, value.NewsletterEmail,
		value.SenderName, value.SEOTitle, value.SEODescription, value.SEOIndexable, value.UpdatedAt,
	))
}

func scanSettings(row rowScanner) (settingsdomain.Settings, error) {
	var value settingsdomain.Settings
	if err := row.Scan(
		&value.SiteName, &value.SiteDescription, &value.SupportEmail,
		&value.NewsletterEmail, &value.SenderName, &value.SEOTitle,
		&value.SEODescription, &value.SEOIndexable, &value.UpdatedAt,
	); err != nil {
		return settingsdomain.Settings{}, fmt.Errorf("scan site settings: %w", err)
	}
	return value, nil
}
