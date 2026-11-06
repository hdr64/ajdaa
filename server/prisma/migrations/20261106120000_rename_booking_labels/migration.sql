-- Data fix: rename the booking nav label to "Register Interest" where the stored
-- `nav` CMS section still has the old default. Admin-customised labels are kept.

UPDATE "cms_sections"
SET "content" = (
      SELECT jsonb_agg(
        CASE WHEN t.e->>'page' = 'booking'
              AND t.e->>'labelAr' = 'حجز معاينة'
             THEN t.e || '{"labelAr":"سجل اهتمامك","labelEn":"Register Interest"}'::jsonb
             ELSE t.e END
        ORDER BY t.ord)
      FROM jsonb_array_elements("content"::jsonb) WITH ORDINALITY AS t(e, ord)
    )::text,
    "version" = "version" + 1
WHERE "key" = 'nav'
  AND jsonb_typeof("content"::jsonb) = 'array'
  AND "content"::jsonb @> '[{"page":"booking","labelAr":"حجز معاينة"}]';
