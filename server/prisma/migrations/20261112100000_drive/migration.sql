-- Drive: private admin file storage with virtual folders and a trash.
CREATE TABLE "drive_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "trashedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drive_files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT,
    "slug" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "trashedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drive_folders_parentId_idx" ON "drive_folders"("parentId");
CREATE INDEX "drive_folders_trashedAt_idx" ON "drive_folders"("trashedAt");
CREATE UNIQUE INDEX "drive_files_slug_key" ON "drive_files"("slug");
CREATE INDEX "drive_files_folderId_idx" ON "drive_files"("folderId");
CREATE INDEX "drive_files_trashedAt_idx" ON "drive_files"("trashedAt");

ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "drive_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "drive_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
