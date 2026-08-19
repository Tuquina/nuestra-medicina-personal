DROP INDEX IF EXISTS pages_one_home_idx;

ALTER TABLE pages DROP CONSTRAINT pages_type_check;
ALTER TABLE pages DROP CONSTRAINT pages_check;

ALTER TABLE pages ADD CONSTRAINT pages_type_check CHECK (
    type IN (
        'HOME', 'BOOK', 'MEDITACIONES', 'HERRAMIENTAS', 'CONTACTO',
        'SOPORTE', 'FAQ', 'TERMINOS', 'PRIVACIDAD'
    )
);
ALTER TABLE pages ADD CONSTRAINT pages_book_relation_check CHECK (
    (type = 'BOOK' AND book_id IS NOT NULL)
    OR (type <> 'BOOK' AND book_id IS NULL)
);

CREATE UNIQUE INDEX pages_one_singleton_type_idx ON pages (type) WHERE type <> 'BOOK';
