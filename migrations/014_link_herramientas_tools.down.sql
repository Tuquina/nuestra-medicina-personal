-- Remove the tool links added by 014_link_herramientas_tools.up.sql
-- (and any set later through the admin), returning every card to
-- "coming soon".
CREATE FUNCTION pg_temp.nmp_unlink_collection_tools(content JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN content IS NULL OR jsonb_typeof(content -> 'sections') <> 'array' THEN content
        ELSE jsonb_set(content, '{sections}', COALESCE((
            SELECT jsonb_agg(
                CASE
                    WHEN section ->> 'type' = 'collection'
                         AND jsonb_typeof(section -> 'props' -> 'cards') = 'array'
                    THEN jsonb_set(section, '{props,cards}', COALESCE((
                        SELECT jsonb_agg(card - 'tool' ORDER BY card_position)
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
SET draft_content = pg_temp.nmp_unlink_collection_tools(draft_content),
    published_content = pg_temp.nmp_unlink_collection_tools(published_content)
WHERE type = 'HERRAMIENTAS' AND slug = 'herramientas';

DROP FUNCTION pg_temp.nmp_unlink_collection_tools(JSONB);
