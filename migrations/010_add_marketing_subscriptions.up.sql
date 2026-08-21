CREATE TABLE marketing_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'SUBSCRIBED' CHECK (status IN ('SUBSCRIBED', 'UNSUBSCRIBED')),
    source TEXT NOT NULL DEFAULT 'UNKNOWN',
    subscribed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX marketing_subscriptions_user_id_idx ON marketing_subscriptions (user_id);
