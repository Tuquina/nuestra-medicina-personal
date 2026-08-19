package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

type EmailRepository struct {
	pool *pgxpool.Pool
}

func NewEmailRepository(pool *pgxpool.Pool) *EmailRepository {
	return &EmailRepository{pool: pool}
}

func (r *EmailRepository) Claim(ctx context.Context, limit, maxAttempts int, now, staleBefore time.Time) ([]emaildomain.Job, error) {
	rows, err := r.pool.Query(ctx, `
		WITH candidates AS (
			SELECT id
			FROM email_jobs
			WHERE attempts < $2
			  AND (
				(status IN ('PENDING', 'FAILED') AND next_attempt_at <= $3)
				OR (status = 'PROCESSING' AND updated_at <= $4)
			  )
			ORDER BY next_attempt_at, created_at
			FOR UPDATE SKIP LOCKED
			LIMIT $1
		)
		UPDATE email_jobs AS jobs
		SET status = 'PROCESSING', attempts = attempts + 1, updated_at = $3
		FROM candidates
		WHERE jobs.id = candidates.id
		RETURNING jobs.id::text, jobs.type, jobs.recipient, jobs.payload,
		          jobs.status, jobs.attempts, jobs.next_attempt_at,
		          jobs.created_at, jobs.updated_at`, limit, maxAttempts, now, staleBefore)
	if err != nil {
		return nil, fmt.Errorf("claim email jobs: %w", err)
	}
	defer rows.Close()
	jobs := make([]emaildomain.Job, 0, limit)
	for rows.Next() {
		var job emaildomain.Job
		if err := rows.Scan(
			&job.ID, &job.Type, &job.Recipient, &job.Payload, &job.Status,
			&job.Attempts, &job.NextAttemptAt, &job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan claimed email job: %w", err)
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate claimed email jobs: %w", err)
	}
	return jobs, nil
}

func (r *EmailRepository) MarkSent(ctx context.Context, jobID, providerMessageID string, now time.Time) error {
	if _, err := r.pool.Exec(ctx, `
		UPDATE email_jobs
		SET status = 'SENT', provider_message_id = $2, last_error = NULL,
		    sent_at = $3, updated_at = $3
		WHERE id = $1::uuid AND status = 'PROCESSING'`, jobID, providerMessageID, now); err != nil {
		return fmt.Errorf("mark email sent: %w", err)
	}
	return nil
}

func (r *EmailRepository) MarkFailed(ctx context.Context, jobID, message string, nextAttemptAt, now time.Time) error {
	if len(message) > 2000 {
		message = message[:2000]
	}
	if _, err := r.pool.Exec(ctx, `
		UPDATE email_jobs
		SET status = 'FAILED', last_error = $2, next_attempt_at = $3, updated_at = $4
		WHERE id = $1::uuid AND status = 'PROCESSING'`, jobID, message, nextAttemptAt, now); err != nil {
		return fmt.Errorf("mark email failed: %w", err)
	}
	return nil
}
