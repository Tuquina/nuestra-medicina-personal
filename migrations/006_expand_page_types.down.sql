DELETE FROM pages WHERE type NOT IN ('HOME', 'BOOK');

DROP INDEX IF EXISTS pages_one_singleton_type_idx;
ALTER TABLE pages DROP CONSTRAINT pages_book_relation_check;
ALTER TABLE pages DROP CONSTRAINT pages_type_check;

ALTER TABLE pages ADD CONSTRAINT pages_type_check CHECK (type IN ('HOME', 'BOOK'));
ALTER TABLE pages ADD CONSTRAINT pages_check CHECK (
    (type = 'HOME' AND book_id IS NULL) OR (type = 'BOOK' AND book_id IS NOT NULL)
);

CREATE UNIQUE INDEX pages_one_home_idx ON pages (type) WHERE type = 'HOME';
