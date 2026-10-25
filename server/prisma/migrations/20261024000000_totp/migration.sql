-- AlterTable: authenticator-app (TOTP) 2FA state on the admin account.
--   totpSecretEnc  AES-256-GCM box (see services/secretBox.ts); NULL when unset.
--   totpEnabledAt  NULL until a first code has been proven, i.e. while a secret
--                  is only "pending" and must not be treated as a second factor.
--   totpLastStep   RFC 6238 time step of the last accepted code, to reject a
--                  replay of the same 30-second window.
ALTER TABLE "AdminUser" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "totpLastStep" INTEGER;

-- CreateTable: one-time recovery codes, stored only as peppered SHA-256.
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveryCode_adminUserId_idx" ON "RecoveryCode"("adminUserId");

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
