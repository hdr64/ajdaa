-- CreateTable
CREATE TABLE "developer_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "solution" TEXT,
    "screenshotUrl" TEXT,
    "adminName" TEXT,
    "adminEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "developer_notes_status_idx" ON "developer_notes"("status");
CREATE INDEX "developer_notes_createdAt_idx" ON "developer_notes"("createdAt");
