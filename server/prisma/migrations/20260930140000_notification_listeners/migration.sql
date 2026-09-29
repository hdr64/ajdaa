-- CreateTable
CREATE TABLE "NotificationListener" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationListener_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationListener_event_enabled_idx" ON "NotificationListener"("event", "enabled");
