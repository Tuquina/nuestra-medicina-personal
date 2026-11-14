-- Removes every meditation page (their versions cascade) and restores the
-- singleton rule. The "Respirar y empezar" placeholder card is not re-added:
-- it can be recreated from the Meditaciones editor if needed.
DELETE FROM pages WHERE type = 'MEDITACION';

DROP INDEX IF EXISTS pages_type_created_idx;
DROP INDEX IF EXISTS pages_one_singleton_type_idx;
CREATE UNIQUE INDEX pages_one_singleton_type_idx ON pages (type) WHERE type <> 'BOOK';

ALTER TABLE pages DROP CONSTRAINT pages_type_check;
ALTER TABLE pages ADD CONSTRAINT pages_type_check CHECK (
    type IN (
        'HOME', 'BOOK', 'MEDITACIONES', 'HERRAMIENTAS', 'CONTACTO',
        'SOPORTE', 'FAQ', 'TERMINOS', 'PRIVACIDAD'
    )
);
