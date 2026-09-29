-- AlterTable
ALTER TABLE "Project" ADD COLUMN "publishStatus" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "Project" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Update existing projects to set publishedAt to createdAt
UPDATE "Project" SET "publishedAt" = "createdAt";
