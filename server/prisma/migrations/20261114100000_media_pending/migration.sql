-- Staged uploads (media picker): rows created from the picker carry
-- pending = true and every Library listing hides them until the uploading
-- admin confirms them. Existing rows keep pending = false, so nothing
-- changes for what is already in the Library.
ALTER TABLE "media_files" ADD COLUMN "pending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "media_folders" ADD COLUMN "pending" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "media_files_pending_idx" ON "media_files"("pending");
