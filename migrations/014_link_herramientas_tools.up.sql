-- Link the three seeded Herramientas cards (migration 007) to the
-- interactive tools the frontend now ships. Only cards that still carry
-- their seeded ids and have no tool yet are touched, so any admin edits
-- to titles, copy or extra cards are preserved.
CREATE FUNCTION pg_temp.nmp_link_collection_tools(content JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN content IS NULL OR jsonb_typeof(content -> 'sections') <> 'array' THEN content
        ELSE jsonb_set(content, '{sections}', COALESCE((
            SELECT jsonb_agg(
                CASE
                    WHEN section ->> 'type' = 'collection'
                         AND jsonb_typeof(section -> 'props' -> 'cards') = 'array'
                    THEN jsonb_set(section, '{props,cards}', COALESCE((
                        SELECT jsonb_agg(
                            CASE
                                WHEN card ? 'tool' THEN card
                                WHEN card ->> 'id' = 'card-1' THEN card || '{"tool":"escritura-diaria"}'::jsonb
                                WHEN card ->> 'id' = 'card-2' THEN card || '{"tool":"preguntas"}'::jsonb
                                WHEN card ->> 'id' = 'card-3' THEN card || '{"tool":"cierre-semanal"}'::jsonb
                                ELSE card
                            END
                            ORDER BY card_position
                        )
                        FROM jsonb_array_elements(section -> 'props' -> 'cards')
                            WITH ORDINALITY AS cards (card, card_position)
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
SET draft_content = pg_temp.nmp_link_collection_tools(draft_content),
    published_content = pg_temp.nmp_link_collection_tools(published_content)
WHERE type = 'HERRAMIENTAS' AND slug = 'herramientas';

DROP FUNCTION pg_temp.nmp_link_collection_tools(JSONB);
