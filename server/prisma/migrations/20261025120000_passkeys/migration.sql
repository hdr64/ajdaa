-- CreateTable: Passkey
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "transports" TEXT,
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WebauthnChallenge
CREATE TABLE "WebauthnChallenge" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "adminUserId" TEXT,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebauthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_adminUserId_idx" ON "Passkey"("adminUserId");

-- CreateIndex
CREATE INDEX "WebauthnChallenge_adminUserId_idx" ON "WebauthnChallenge"("adminUserId");

-- CreateIndex
CREATE INDEX "WebauthnChallenge_expiresAt_idx" ON "WebauthnChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
