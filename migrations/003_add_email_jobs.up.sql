CREATE TABLE email_jobs (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN (
        'payment.approved',
        'payment.pending',
        'payment.failed',
        'purchase.refunded',
        'ebook.available'
    )),
    recipient TEXT NOT NULL,
    payload JSONB NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    provider_message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX email_jobs_dispatch_idx
    ON email_jobs (status, next_attempt_at)
    WHERE status IN ('PENDING', 'PROCESSING', 'FAILED');
