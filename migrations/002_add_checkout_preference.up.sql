ALTER TABLE orders
    ADD COLUMN provider_preference_id TEXT,
    ADD COLUMN checkout_url TEXT;

CREATE UNIQUE INDEX orders_provider_preference_id_idx
    ON orders (provider_preference_id)
    WHERE provider_preference_id IS NOT NULL;
