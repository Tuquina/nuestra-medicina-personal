CREATE UNIQUE INDEX pages_one_home_idx ON pages (type) WHERE type = 'HOME';
CREATE UNIQUE INDEX pages_one_page_per_book_idx ON pages (book_id) WHERE type = 'BOOK';
