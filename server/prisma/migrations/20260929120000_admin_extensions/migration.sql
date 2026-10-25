-- AlterTable
ALTER TABLE "Project" ADD COLUMN "brochureUrl" TEXT;

-- AlterTable
ALTER TABLE "CustomerInquiry" ADD COLUMN "notes" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
