-- Set correct Arabic defaults for columns that currently have mojibake in the init migration.
-- These ALTER COLUMN SET DEFAULT statements override the incorrectly encoded defaults
-- from 20260923190412_init without modifying the applied migration.
-- Copy the Arabic strings byte-for-byte from schema.prisma using a script never retype.

-- AdminUser.roleAr: correct Arabic = "مسؤول مبيعات"
ALTER TABLE "AdminUser" ALTER COLUMN "roleAr" SET DEFAULT 'مسؤول مبيعات';

-- PropertyUnit.statusAr: correct Arabic = "متاح"
ALTER TABLE "PropertyUnit" ALTER COLUMN "statusAr" SET DEFAULT 'متاح';

-- CustomerInquiry.statusAr: correct Arabic = "جديد"
ALTER TABLE "CustomerInquiry" ALTER COLUMN "statusAr" SET DEFAULT 'جديد';

-- Index: Project.publishStatus
CREATE INDEX "Project_publishStatus_idx" ON "Project"("publishStatus");

-- Index: Project.city
CREATE INDEX "Project_city_idx" ON "Project"("city");

-- Index: CustomerInquiry.createdAt
CREATE INDEX "CustomerInquiry_createdAt_idx" ON "CustomerInquiry"("createdAt");