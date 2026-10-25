-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Department_nameAr_key" ON "Department"("nameAr");

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "roleId" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "departmentId" TEXT;

-- InsertSystemRoles
INSERT INTO "Role" ("id", "key", "nameAr", "nameEn", "description", "permissions", "isSystem", "sortOrder", "createdAt", "updatedAt")
VALUES
    ('role_super_admin', 'super_admin', 'مدير عام النظام (Super Admin)', 'Super Admin', 'Full system access and user management', '["manageProjects","manageUnits","viewInquiries","exportData","manageUsers"]', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_project_manager', 'project_manager', 'مدير التطوير والمشاريع', 'Project Manager', 'Project and unit management', '["manageProjects","manageUnits","viewInquiries","exportData"]', false, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_sales_agent', 'sales_agent', 'مسؤول تأجير ومبيعات', 'Sales Agent', 'Unit management and inquiry handling', '["manageUnits","viewInquiries"]', false, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_viewer', 'viewer', 'محلل استثماري ومتابع', 'Viewer', 'View inquiries and export data', '["viewInquiries","exportData"]', false, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- UpdateAdminUserRoleId
UPDATE "AdminUser"
SET "roleId" = 'role_' || "role"
WHERE "role" IN ('super_admin', 'project_manager', 'sales_agent', 'viewer');

-- InsertDepartmentsFromDistinctAdminUserDepartment
INSERT INTO "Department" ("id", "nameAr", "createdAt", "updatedAt")
SELECT DISTINCT
    'dept_' || md5("department"),
    "department",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "AdminUser"
WHERE "department" IS NOT NULL AND TRIM("department") <> ''
ON CONFLICT ("nameAr") DO NOTHING;

-- UpdateAdminUserDepartmentId
UPDATE "AdminUser"
SET "departmentId" = 'dept_' || md5("department")
WHERE "department" IS NOT NULL AND TRIM("department") <> '';

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
