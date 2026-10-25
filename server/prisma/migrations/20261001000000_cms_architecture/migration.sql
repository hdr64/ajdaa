-- CreateTable
CREATE TABLE "cms_sections" (
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "cms_sections_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "cms_section_versions" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_section_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_clients" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sectorAr" TEXT NOT NULL,
    "sectorEn" TEXT NOT NULL,
    "descAr" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "tagsAr" TEXT NOT NULL,
    "tagsEn" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_section_versions_sectionKey_version_key" ON "cms_section_versions"("sectionKey", "version");
CREATE INDEX "cms_section_versions_sectionKey_idx" ON "cms_section_versions"("sectionKey");
CREATE INDEX "cms_clients_visible_order_idx" ON "cms_clients"("visible", "order");

-- AddForeignKey
ALTER TABLE "cms_section_versions" ADD CONSTRAINT "cms_section_versions_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "cms_sections"("key") ON DELETE CASCADE ON UPDATE CASCADE;
