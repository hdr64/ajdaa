-- Library: virtual folders for the media library. Folders exist only in the
-- database; files stay flat on disk, so public URLs never change.
CREATE TABLE "media_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_folders_parentId_idx" ON "media_folders"("parentId");

ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Files keep their disk location; moving a file between folders only updates the row.
ALTER TABLE "media_files" ADD COLUMN "folderId" TEXT;

CREATE INDEX "media_files_folderId_idx" ON "media_files"("folderId");

ALTER TABLE "media_files" ADD CONSTRAINT "media_files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
