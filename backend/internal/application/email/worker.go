package email

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log/slog"
	"math"
	"strings"
	texttemplate "text/template"
	"time"

	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

type Repository interface {
	Claim(context.Context, int, int, time.Time, time.Time) ([]emaildomain.Job, error)
	MarkSent(context.Context, string, string, time.Time) error
	MarkFailed(context.Context, string, string, time.Time, time.Time) error
}

type Sender interface {
	Configured() bool
	Send(context.Context, emaildomain.Message) (string, error)
}

type Worker struct {
	repository  Repository
	sender      Sender
	renderer    *Renderer
	logger      *slog.Logger
	interval    time.Duration
	lease       time.Duration
	batchSize   int
	maxAttempts int
	now         func() time.Time
}

func NewWorker(repository Repository, sender Sender, renderer *Renderer, logger *slog.Logger, interval, lease time.Duration, batchSize, maxAttempts int) *Worker {
	return &Worker{
		repository: repository, sender: sender, renderer: renderer, logger: logger,
		interval: interval, lease: lease, batchSize: batchSize, maxAttempts: maxAttempts,
		now: time.Now,
	}
}

func (w *Worker) Run(ctx context.Context) {
	w.process(ctx)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.process(ctx)
		}
	}
}

func (w *Worker) process(ctx context.Context) {
	now := w.now().UTC()
	jobs, err := w.repository.Claim(ctx, w.batchSize, w.maxAttempts, now, now.Add(-w.lease))
	if err != nil {
		if ctx.Err() == nil {
			w.logger.Error("claim transactional emails", "error", err)
		}
		return
	}
	for _, job := range jobs {
		message, err := w.renderer.Render(job)
		if err == nil {
			var providerID string
			providerID, err = w.sender.Send(ctx, message)
			if err == nil {
				if markErr := w.repository.MarkSent(ctx, job.ID, providerID, w.now().UTC()); markErr != nil {
					w.logger.Error("mark transactional email sent", "email_job_id", job.ID, "error", markErr)
				}
				continue
			}
		}
		failedAt := w.now().UTC()
		nextAttempt := failedAt.Add(retryDelay(job.Attempts))
		if markErr := w.repository.MarkFailed(ctx, job.ID, err.Error(), nextAttempt, failedAt); markErr != nil {
			w.logger.Error("mark transactional email failed", "email_job_id", job.ID, "error", markErr)
		}
		w.logger.Warn("transactional email failed", "email_job_id", job.ID, "attempt", job.Attempts, "error", err)
	}
}

func retryDelay(attempt int) time.Duration {
	exponent := math.Max(0, math.Min(float64(attempt-1), 6))
	delay := time.Minute * time.Duration(1<<int(exponent))
	if delay > time.Hour {
		return time.Hour
	}
	return delay
}

type Renderer struct {
	appURL       string
	supportEmail string
	html         map[emaildomain.JobType]*template.Template
	text         map[emaildomain.JobType]*texttemplate.Template
}

type templateData struct {
	BookTitle       string
	OrderID         string
	FormattedAmount string
	LibraryURL      string
	SupportEmail    string
	EbookAvailable  bool
}

func NewRenderer(appURL, supportEmail string) (*Renderer, error) {
	renderer := &Renderer{
		appURL: strings.TrimRight(appURL, "/"), supportEmail: supportEmail,
		html: make(map[emaildomain.JobType]*template.Template),
		text: make(map[emaildomain.JobType]*texttemplate.Template),
	}
	for _, jobType := range []emaildomain.JobType{
		emaildomain.PaymentApproved, emaildomain.PaymentPending, emaildomain.PaymentFailed,
		emaildomain.PurchaseRefunded, emaildomain.EbookAvailable,
	} {
		name := string(jobType)
		htmlTemplate, err := template.ParseFS(templateFiles, "templates/"+name+".html")
		if err != nil {
			return nil, fmt.Errorf("parse %s HTML template: %w", name, err)
		}
		textTemplate, err := texttemplate.ParseFS(templateFiles, "templates/"+name+".txt")
		if err != nil {
			return nil, fmt.Errorf("parse %s text template: %w", name, err)
		}
		renderer.html[jobType] = htmlTemplate
		renderer.text[jobType] = textTemplate
	}
	return renderer, nil
}

func (r *Renderer) Render(job emaildomain.Job) (emaildomain.Message, error) {
	var payload emaildomain.PaymentPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return emaildomain.Message{}, fmt.Errorf("decode email payload: %w", err)
	}
	if job.Recipient == "" || payload.BookTitle == "" || payload.OrderID == "" {
		return emaildomain.Message{}, fmt.Errorf("email payload is incomplete")
	}
	htmlTemplate, htmlOK := r.html[job.Type]
	textTemplate, textOK := r.text[job.Type]
	if !htmlOK || !textOK {
		return emaildomain.Message{}, fmt.Errorf("unsupported email job type %q", job.Type)
	}
	data := templateData{
		BookTitle: payload.BookTitle, OrderID: payload.OrderID,
		FormattedAmount: formatMoney(payload.AmountMinorUnits, payload.Currency),
		LibraryURL:      r.appURL + "/biblioteca", SupportEmail: r.supportEmail,
		EbookAvailable: payload.EbookAvailable,
	}
	var htmlBody, textBody strings.Builder
	if err := htmlTemplate.Execute(&htmlBody, data); err != nil {
		return emaildomain.Message{}, fmt.Errorf("render HTML email: %w", err)
	}
	if err := textTemplate.Execute(&textBody, data); err != nil {
		return emaildomain.Message{}, fmt.Errorf("render text email: %w", err)
	}
	return emaildomain.Message{
		To: job.Recipient, Subject: subjectFor(job.Type),
		TextBody: textBody.String(), HTMLBody: htmlBody.String(),
	}, nil
}

func subjectFor(jobType emaildomain.JobType) string {
	switch jobType {
	case emaildomain.PaymentApproved:
		return "Tu compra fue confirmada"
	case emaildomain.PaymentPending:
		return "Tu pago está pendiente"
	case emaildomain.PaymentFailed:
		return "No pudimos confirmar tu pago"
	case emaildomain.PurchaseRefunded:
		return "Tu compra fue reembolsada"
	case emaildomain.EbookAvailable:
		return "Tu eBook ya está disponible"
	default:
		return "Actualización de tu compra"
	}
}

func formatMoney(minorUnits int64, currency string) string {
	major := minorUnits / 100
	minor := minorUnits % 100
	return fmt.Sprintf("%s %d,%02d", strings.ToUpper(currency), major, minor)
}
