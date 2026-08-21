CREATE TABLE book_manuscripts (
    book_id UUID PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
    chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
