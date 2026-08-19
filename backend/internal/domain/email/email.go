package email

import (
	"encoding/json"
	"time"
)

type JobType string

const (
	PaymentApproved  JobType = "payment.approved"
	PaymentPending   JobType = "payment.pending"
	PaymentFailed    JobType = "payment.failed"
	PurchaseRefunded JobType = "purchase.refunded"
	EbookAvailable   JobType = "ebook.available"
)

type JobStatus string

const (
	StatusPending    JobStatus = "PENDING"
	StatusProcessing JobStatus = "PROCESSING"
	StatusSent       JobStatus = "SENT"
	StatusFailed     JobStatus = "FAILED"
)

type Job struct {
	ID            string
	Type          JobType
	Recipient     string
	Payload       json.RawMessage
	Status        JobStatus
	Attempts      int
	NextAttemptAt time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type PaymentPayload struct {
	OrderID          string `json:"orderId"`
	BookTitle        string `json:"bookTitle"`
	AmountMinorUnits int64  `json:"amountMinorUnits"`
	Currency         string `json:"currency"`
	EbookAvailable   bool   `json:"ebookAvailable"`
}

type Message struct {
	To       string
	Subject  string
	TextBody string
	HTMLBody string
}
