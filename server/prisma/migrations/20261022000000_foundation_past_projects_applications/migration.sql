-- AlterTable
ALTER TABLE "Project" ADD COLUMN "model3dUrl" TEXT;

-- CreateTable
CREATE TABLE "past_projects" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "category" TEXT,
    "categoryEn" TEXT,
    "image" TEXT NOT NULL,
    "gallery" TEXT,
    "pdfUrl" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "past_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "message" TEXT,
    "cvPath" TEXT,
    "cvOriginalName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "past_projects_published_sortOrder_idx" ON "past_projects"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE INDEX "job_applications_createdAt_idx" ON "job_applications"("createdAt");
