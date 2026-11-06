-- Data fix: the "Book a Viewing / Register Interest" item is removed from the
-- site menu. The /booking page itself stays (hero CTA, project interest buttons
-- and direct URLs still reach it); only the nav entry goes away. The stored
-- `nav` section overrides the code defaults, so it has to be edited too: every
-- booking entry goes, including one an admin added by hand.

UPDATE "cms_sections"
SET "content" = (
      SELECT jsonb_agg(t.e ORDER BY t.ord)
      FROM jsonb_array_elements("content"::jsonb) WITH ORDINALITY AS t(e, ord)
      WHERE t.e->>'page' <> 'booking'
    )::text,
    "version" = "version" + 1
WHERE "key" = 'nav'
  AND jsonb_typeof("content"::jsonb) = 'array'
  AND "content"::jsonb @> '[{"page":"booking"}]';
