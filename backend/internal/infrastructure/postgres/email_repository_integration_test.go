//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

func TestEmailRepositoryClaimsAndRetriesJobs(t *testing.T) {
	ctx := context.Background()
	pool, err := Open(ctx, os.Getenv("DATABASE_URL"), 2, 5*time.Second)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	const jobID = "50000000-0000-4000-8000-000000000001"
	cleanup := func() {
		_, _ = pool.Exec(ctx, `
			DELETE FROM email_jobs
			WHERE id = $1::uuid
			   OR recipient IN ('mail@example.com', 'buyer@example.com', 'owner@example.com')
		`, jobID)
	}
	cleanup()
	t.Cleanup(cleanup)
	now := time.Date(2026, 8, 19, 18, 0, 0, 0, time.UTC)
	if _, err := pool.Exec(ctx, `
		INSERT INTO email_jobs (id, type, recipient, payload, dedupe_key, next_attempt_at, created_at, updated_at)
		VALUES ($1::uuid, 'payment.approved', 'mail@example.com', '{"orderId":"order-1"}',
		        'integration-email-job', $2, $2, $2)`, jobID, now); err != nil {
		t.Fatalf("seed email job: %v", err)
	}
	repository := NewEmailRepository(pool)
	claimed, err := repository.Claim(ctx, 5, 3, now, now.Add(-time.Minute))
	if err != nil || len(claimed) != 1 || claimed[0].Status != emaildomain.StatusProcessing || claimed[0].Attempts != 1 {
		t.Fatalf("claim job: %#v, %v", claimed, err)
	}
	if err := repository.MarkFailed(ctx, jobID, "temporary failure", now.Add(time.Minute), now); err != nil {
		t.Fatalf("mark failed: %v", err)
	}
	claimed, err = repository.Claim(ctx, 5, 3, now.Add(30*time.Second), now.Add(-time.Minute))
	if err != nil || len(claimed) != 0 {
		t.Fatalf("job claimed before backoff elapsed: %#v, %v", claimed, err)
	}
	claimed, err = repository.Claim(ctx, 5, 3, now.Add(2*time.Minute), now)
	if err != nil || len(claimed) != 1 || claimed[0].Attempts != 2 {
		t.Fatalf("reclaim job: %#v, %v", claimed, err)
	}
	if err := repository.MarkSent(ctx, jobID, "gmail-message-id", now.Add(2*time.Minute)); err != nil {
		t.Fatalf("mark sent: %v", err)
	}
	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM email_jobs WHERE id = $1::uuid`, jobID).Scan(&status); err != nil || status != "SENT" {
		t.Fatalf("sent status: %q, %v", status, err)
	}
}
