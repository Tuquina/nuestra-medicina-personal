DROP INDEX IF EXISTS orders_provider_preference_id_idx;

ALTER TABLE orders
    DROP COLUMN IF EXISTS checkout_url,
    DROP COLUMN IF EXISTS provider_preference_id;
