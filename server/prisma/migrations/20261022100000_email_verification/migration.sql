-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationToken_adminUserId_idx" ON "EmailVerificationToken"("adminUserId");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every account that already exists keeps its access. The new
-- `pending` status and the email-verification rule apply only to accounts
-- created from now on.
UPDATE "AdminUser" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;
