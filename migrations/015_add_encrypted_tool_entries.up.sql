-- Encrypted, per-user storage for the Herramientas tools (ADR 0006).
-- Nothing here is readable without PERSONAL_DATA_KEY, which never lives in
-- the database: user_data_keys holds each user's data key wrapped with it,
-- and tool_entries holds content encrypted with that data key.

CREATE TABLE user_data_keys (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    wrapped_key BYTEA NOT NULL CHECK (octet_length(wrapped_key) BETWEEN 32 AND 256),
    kek_version SMALLINT NOT NULL CHECK (kek_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tool_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- tool/kind are allow-listed in the domain (backend/internal/domain/toolentry);
    -- the database only enforces their shape, so adding a tool needs no schema change.
    tool TEXT COLLATE "C" NOT NULL CHECK (tool ~ '^[a-z][a-z0-9-]{0,39}$'),
    kind TEXT COLLATE "C" NOT NULL CHECK (kind ~ '^[a-z][a-z0-9-]{0,31}$'),
    entry_key TEXT COLLATE "C" NOT NULL CHECK (entry_key ~ '^[A-Za-z0-9_-]{1,64}$'),
    ciphertext BYTEA NOT NULL CHECK (octet_length(ciphertext) BETWEEN 29 AND 262144),
    format_version SMALLINT NOT NULL DEFAULT 1 CHECK (format_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Also the index behind per-user listing and cursor pagination ("C"
    -- collation keeps that ordering bytewise and predictable).
    CONSTRAINT tool_entries_user_entry_key UNIQUE (user_id, tool, kind, entry_key)
);
