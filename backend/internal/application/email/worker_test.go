package email

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

type repositoryStub struct {
	jobs      []emaildomain.Job
	sentID    string
	failedID  string
	nextRetry time.Time
}

func (r *repositoryStub) Claim(context.Context, int, int, time.Time, time.Time) ([]emaildomain.Job, error) {
	jobs := r.jobs
	r.jobs = nil
	return jobs, nil
}
func (r *repositoryStub) MarkSent(_ context.Context, id, _ string, _ time.Time) error {
	r.sentID = id
	return nil
}
func (r *repositoryStub) MarkFailed(_ context.Context, id, _ string, next, _ time.Time) error {
	r.failedID = id
	r.nextRetry = next
	return nil
}

type senderStub struct{ err error }

func (senderStub) Configured() bool { return true }
func (s senderStub) Send(context.Context, emaildomain.Message) (string, error) {
	return "gmail-id", s.err
}

func TestWorkerMarksRenderedEmailAsSent(t *testing.T) {
	payload, _ := json.Marshal(emaildomain.PaymentPayload{
		OrderID: "order-1", BookTitle: "El poder de tu historia",
		AmountMinorUnits: 189000, Currency: "ARS",
	})
	repository := &repositoryStub{jobs: []emaildomain.Job{{
		ID: "job-1", Type: emaildomain.PaymentApproved, Recipient: "buyer@example.com",
		Payload: payload, Attempts: 1,
	}}}
	renderer, err := NewRenderer("https://example.com", "soporte@example.com")
	if err != nil {
		t.Fatal(err)
	}
	worker := NewWorker(repository, senderStub{}, renderer, slog.New(slog.NewTextHandler(io.Discard, nil)), time.Second, time.Minute, 5, 5)
	worker.now = func() time.Time { return time.Date(2026, 8, 19, 20, 0, 0, 0, time.UTC) }
	worker.process(context.Background())
	if repository.sentID != "job-1" || repository.failedID != "" {
		t.Fatalf("unexpected result: sent=%q failed=%q", repository.sentID, repository.failedID)
	}
}

func TestWorkerBacksOffAfterProviderFailure(t *testing.T) {
	payload, _ := json.Marshal(emaildomain.PaymentPayload{OrderID: "order-1", BookTitle: "Book"})
	repository := &repositoryStub{jobs: []emaildomain.Job{{
		ID: "job-1", Type: emaildomain.PaymentPending, Recipient: "buyer@example.com",
		Payload: payload, Attempts: 3,
	}}}
	renderer, _ := NewRenderer("https://example.com", "support@example.com")
	now := time.Date(2026, 8, 19, 20, 0, 0, 0, time.UTC)
	worker := NewWorker(repository, senderStub{err: errors.New("temporary")}, renderer, slog.New(slog.NewTextHandler(io.Discard, nil)), time.Second, time.Minute, 5, 5)
	worker.now = func() time.Time { return now }
	worker.process(context.Background())
	if repository.failedID != "job-1" || !repository.nextRetry.Equal(now.Add(4*time.Minute)) {
		t.Fatalf("unexpected retry: id=%q next=%s", repository.failedID, repository.nextRetry)
	}
}

func TestRendererProducesBrandedAlternativeBodies(t *testing.T) {
	payload, _ := json.Marshal(emaildomain.PaymentPayload{
		OrderID: "order-1", BookTitle: "Historia <especial>", AmountMinorUnits: 12345, Currency: "ars", EbookAvailable: true,
	})
	renderer, _ := NewRenderer("https://example.com/", "support@example.com")
	message, err := renderer.Render(emaildomain.Job{
		Type: emaildomain.PaymentApproved, Recipient: "buyer@example.com", Payload: payload,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(message.TextBody, "ARS 123,45") || !strings.Contains(message.TextBody, "https://example.com/biblioteca") {
		t.Fatalf("unexpected text body: %s", message.TextBody)
	}
	if strings.Contains(message.HTMLBody, "Historia <especial>") || !strings.Contains(message.HTMLBody, "Historia &lt;especial&gt;") {
		t.Fatalf("HTML data was not escaped: %s", message.HTMLBody)
	}
}
