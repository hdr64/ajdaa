-- Data fix: the stored `nav` CMS section predates the Past Works page and still
-- marks "Book a Viewing" as a call-to-action button, so it overrides the code
-- defaults. Add the Past Works entry when it is missing and make booking a
-- plain link. Admin-customised labels and other entries are kept.

UPDATE "cms_sections"
SET "content" = (
      SELECT jsonb_agg(s.x ORDER BY (s.x->>'order')::int)
      FROM (
        SELECT CASE WHEN (e->>'order')::int >= 3
                    THEN jsonb_set(e, '{order}', to_jsonb((e->>'order')::int + 1))
                    ELSE e END AS x
        FROM jsonb_array_elements("content"::jsonb) AS e
        UNION ALL
        SELECT '{"id":"nav-past-works","labelAr":"أعمالنا السابقة","labelEn":"Past Works","page":"pastWorks","order":3,"enabled":true}'::jsonb
      ) AS s
    )::text,
    "version" = "version" + 1
WHERE "key" = 'nav'
  AND jsonb_typeof("content"::jsonb) = 'array'
  AND NOT ("content"::jsonb @> '[{"page":"pastWorks"}]');

UPDATE "cms_sections"
SET "content" = (
      SELECT jsonb_agg(CASE WHEN t.e->>'page' = 'booking' THEN t.e || '{"isCta":false}'::jsonb ELSE t.e END ORDER BY t.ord)
      FROM jsonb_array_elements("content"::jsonb) WITH ORDINALITY AS t(e, ord)
    )::text,
    "version" = "version" + 1
WHERE "key" = 'nav'
  AND "content"::jsonb @> '[{"page":"booking","isCta":true}]';
