-- Meditation pages (`/meditaciones/{slug}`): any number of CMS pages of type
-- MEDITACION, each holding one `meditation` block (see
-- backend/internal/domain/page/meditation.go).

ALTER TABLE pages DROP CONSTRAINT pages_type_check;
ALTER TABLE pages ADD CONSTRAINT pages_type_check CHECK (
    type IN (
        'HOME', 'BOOK', 'MEDITACIONES', 'HERRAMIENTAS', 'CONTACTO',
        'SOPORTE', 'FAQ', 'TERMINOS', 'PRIVACIDAD', 'MEDITACION'
    )
);

-- Editorial pages stay singletons; books and meditations can repeat.
DROP INDEX IF EXISTS pages_one_singleton_type_idx;
CREATE UNIQUE INDEX pages_one_singleton_type_idx ON pages (type) WHERE type NOT IN ('BOOK', 'MEDITACION');
CREATE INDEX pages_type_created_idx ON pages (type, created_at);

-- The first meditation, published. The YouTube video is a development
-- placeholder: replace it (or unpublish the page) from the backoffice before
-- going live.
INSERT INTO pages (
    id, type, book_id, slug, title, status,
    draft_content, published_content, published_at
)
VALUES (
    '70000000-0000-4000-8000-000000000101'::uuid, 'MEDITACION', NULL, 'respirar-y-empezar', 'Respirar y empezar', 'PUBLISHED',
    $cms${"schemaVersion":1,"sections":[{"id":"meditation","type":"meditation","props":{"title":"Respirar y empezar","description":"Una práctica breve para empezar el día con más calma.","imageId":null,"imageAlt":"","video":{"provider":"youtube","videoId":"IJTmQzcsz7o"},"durationMinutes":null,"guidance":"Buscá un lugar cómodo, sentado o acostado, donde nadie te interrumpa por unos minutos.\n\nCerrá los ojos si te resulta cómodo y empezá simplemente a notar tu respiración, sin cambiarla.\n\nSi aparecen pensamientos, está bien: dejalos pasar y volvé, con amabilidad, a la respiración.\n\nCuando termines, quedate unos segundos en silencio antes de seguir con tu día."}}]}$cms$::jsonb,
    $cms${"schemaVersion":1,"sections":[{"id":"meditation","type":"meditation","props":{"title":"Respirar y empezar","description":"Una práctica breve para empezar el día con más calma.","imageId":null,"imageAlt":"","video":{"provider":"youtube","videoId":"IJTmQzcsz7o"},"durationMinutes":null,"guidance":"Buscá un lugar cómodo, sentado o acostado, donde nadie te interrumpa por unos minutos.\n\nCerrá los ojos si te resulta cómodo y empezá simplemente a notar tu respiración, sin cambiarla.\n\nSi aparecen pensamientos, está bien: dejalos pasar y volvé, con amabilidad, a la respiración.\n\nCuando termines, quedate unos segundos en silencio antes de seguir con tu día."}}]}$cms$::jsonb,
    now()
)
ON CONFLICT DO NOTHING;

-- "Respirar y empezar" was a "Próximamente" card on /meditaciones (seeded by
-- migration 007 as card-1); it is a real meditation now, so drop that
-- placeholder card. Admin edits to other cards are kept.
CREATE FUNCTION pg_temp.nmp_drop_collection_card(content JSONB, card_id TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN content IS NULL OR jsonb_typeof(content -> 'sections') <> 'array' THEN content
        ELSE jsonb_set(content, '{sections}', COALESCE((
            SELECT jsonb_agg(
                CASE
                    WHEN section ->> 'type' = 'collection'
                         AND jsonb_typeof(section -> 'props' -> 'cards') = 'array'
                         -- A collection must keep at least one card.
                         AND jsonb_array_length(section -> 'props' -> 'cards') > 1
                    THEN jsonb_set(section, '{props,cards}', COALESCE((
                        SELECT jsonb_agg(card ORDER BY card_position)
                        FROM jsonb_array_elements(section -> 'props' -> 'cards')
                            WITH ORDINALITY AS cards (card, card_position)
                        WHERE card ->> 'id' IS DISTINCT FROM card_id
                    ), '[]'::jsonb))
                    ELSE section
                END
                ORDER BY section_position
            )
            FROM jsonb_array_elements(content -> 'sections')
                WITH ORDINALITY AS sections (section, section_position)
        ), '[]'::jsonb))
    END
$$;

UPDATE pages
SET draft_content = pg_temp.nmp_drop_collection_card(draft_content, 'card-1'),
    published_content = pg_temp.nmp_drop_collection_card(published_content, 'card-1')
WHERE type = 'MEDITACIONES' AND slug = 'meditaciones';

DROP FUNCTION pg_temp.nmp_drop_collection_card(JSONB, TEXT);
