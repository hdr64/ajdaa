-- Permanent public slug for every library file: /f/<slug>, HTML sites at /html/<slug>/.
ALTER TABLE "media_files" ADD COLUMN "slug" TEXT;

-- Backfill existing rows with a short stable token derived from the id (unique per uuid).
UPDATE "media_files" SET "slug" = 'file-' || substr(md5("id"), 1, 10) WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "media_files_slug_key" ON "media_files"("slug");
