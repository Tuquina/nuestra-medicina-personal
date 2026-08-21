ALTER TABLE orders
    ADD COLUMN coupon_code TEXT,
    ADD COLUMN discount_minor_units BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor_units >= 0);
