-- CreateTable: media_files
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "metadata" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_files_url_key" ON "media_files"("url");
CREATE INDEX "media_files_fileType_idx" ON "media_files"("fileType");
CREATE INDEX "media_files_createdAt_idx" ON "media_files"("createdAt");

-- Backfill super_admin role permissions to include manageMedia (19 system permissions)
UPDATE "Role"
SET "permissions" = '["manageProjects","viewProjects","createProject","editProject","deleteProject","publishProject","manageCms","manageClients","managePastProjects","rollbackCms","manageUnits","viewInquiries","viewApplications","manageApplications","exportData","manageUsers","verifyUsers","manageNotifications","manageMedia"]'
WHERE "key" = 'super_admin' OR "id" = 'role_super_admin';

-- Backfill super_admin users to include manageMedia
UPDATE "AdminUser"
SET "permissions" = '{"manageProjects":true,"viewProjects":true,"createProject":true,"editProject":true,"deleteProject":true,"publishProject":true,"manageCms":true,"manageClients":true,"managePastProjects":true,"rollbackCms":true,"manageUnits":true,"viewInquiries":true,"viewApplications":true,"manageApplications":true,"exportData":true,"manageUsers":true,"verifyUsers":true,"manageNotifications":true,"manageMedia":true}'
WHERE "role" = 'super_admin' OR "email" = 'admin@ajdaa.sa';
