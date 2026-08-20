CREATE TABLE coupons (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('PERCENTAGE', 'FIXED')),
    value BIGINT NOT NULL CHECK (value > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ARS',
    starts_at DATE NOT NULL,
    ends_at DATE NOT NULL,
    usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    applies_to_all BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at >= starts_at),
    CHECK (kind <> 'PERCENTAGE' OR value <= 100),
    CHECK (usage_limit IS NULL OR usage_count <= usage_limit)
);

CREATE INDEX coupons_active_dates_idx ON coupons (active, starts_at, ends_at);

CREATE TABLE coupon_books (
    coupon_id UUID NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, book_id)
);

CREATE INDEX coupon_books_book_id_idx ON coupon_books (book_id);

CREATE TABLE reviews (
    id UUID PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moderated_at TIMESTAMPTZ,
    UNIQUE (book_id, user_id)
);

CREATE INDEX reviews_book_status_created_idx ON reviews (book_id, status, created_at DESC);
CREATE INDEX reviews_status_created_idx ON reviews (status, created_at DESC);

