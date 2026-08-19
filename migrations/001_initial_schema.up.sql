CREATE TABLE users (
    id UUID PRIMARY KEY,
    google_subject TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    picture_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX users_email_idx ON users (email);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE media (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE books (
    id UUID PRIMARY KEY,
    slug VARCHAR(160) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    variant TEXT NOT NULL DEFAULT 'blue' CHECK (variant IN ('gold', 'blue')),
    short_description TEXT NOT NULL DEFAULT '',
    price_minor_units BIGINT NOT NULL DEFAULT 0 CHECK (price_minor_units >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'ARS',
    isbn TEXT NOT NULL DEFAULT '',
    publication_date DATE,
    publication_date_label TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    cover_media_id UUID REFERENCES media (id) ON DELETE SET NULL,
    cover_caption TEXT NOT NULL DEFAULT '',
    ebook_file_path TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    seo_indexable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CHECK (status <> 'PUBLISHED' OR price_minor_units > 0)
);

CREATE INDEX books_status_idx ON books (status);

CREATE TABLE pages (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('HOME', 'BOOK')),
    book_id UUID REFERENCES books (id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    draft_content JSONB NOT NULL DEFAULT '{"schemaVersion":1,"sections":[]}'::jsonb,
    published_content JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CHECK ((type = 'HOME' AND book_id IS NULL) OR (type = 'BOOK' AND book_id IS NOT NULL))
);

CREATE INDEX pages_book_id_idx ON pages (book_id);
CREATE INDEX pages_status_idx ON pages (status);

CREATE TABLE page_versions (
    id UUID PRIMARY KEY,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (page_id, version_number)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED')),
    total_minor_units BIGINT NOT NULL CHECK (total_minor_units >= 0),
    currency CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX orders_user_id_idx ON orders (user_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books (id),
    book_title TEXT NOT NULL,
    unit_price_minor_units BIGINT NOT NULL CHECK (unit_price_minor_units >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    currency CHAR(3) NOT NULL,
    UNIQUE (order_id, book_id)
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_book_id_idx ON order_items (book_id);

CREATE TABLE payments (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders (id),
    provider TEXT NOT NULL,
    provider_payment_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED')),
    amount_minor_units BIGINT NOT NULL CHECK (amount_minor_units >= 0),
    currency CHAR(3) NOT NULL,
    raw_status TEXT NOT NULL,
    provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_payment_id)
);

CREATE INDEX payments_order_id_idx ON payments (order_id);
