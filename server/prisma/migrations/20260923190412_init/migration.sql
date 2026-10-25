-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales_agent',
    "roleAr" TEXT NOT NULL DEFAULT '┘àÏ│Ïñ┘ê┘ä ┘àÏ¿┘èÏ╣ÏºÏ¬',
    "department" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "typeAr" TEXT NOT NULL,
    "typeEn" TEXT,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "price" DOUBLE PRECISION,
    "priceLabel" TEXT,
    "priceType" TEXT NOT NULL,
    "priceTypeEn" TEXT,
    "status" TEXT,
    "statusEn" TEXT,
    "area" DOUBLE PRECISION NOT NULL,
    "rooms" INTEGER,
    "bathrooms" INTEGER,
    "unitsCount" TEXT,
    "unitsCountEn" TEXT,
    "city" TEXT NOT NULL,
    "cityEn" TEXT,
    "image" TEXT NOT NULL,
    "gallery" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "badge" TEXT,
    "badgeEn" TEXT,
    "features" TEXT,
    "featuresEn" TEXT,
    "videoUrl" TEXT,
    "virtualTour3dAvailable" BOOLEAN NOT NULL DEFAULT false,
    "locationHighlightsAr" TEXT,
    "locationHighlightsEn" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFloor" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "floorNameAr" TEXT NOT NULL,
    "floorNameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "totalArea" DOUBLE PRECISION,

    CONSTRAINT "PropertyFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyUnit" (
    "id" TEXT NOT NULL,
    "floorId" INTEGER NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "floorNameAr" TEXT NOT NULL,
    "floorNameEn" TEXT,
    "sectionAr" TEXT,
    "type" TEXT NOT NULL,
    "typeAr" TEXT NOT NULL,
    "typeEn" TEXT,
    "area" DOUBLE PRECISION NOT NULL,
    "priceLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "statusAr" TEXT NOT NULL DEFAULT '┘àÏ¬ÏºÏ¡',
    "statusEn" TEXT DEFAULT 'Available',
    "features" TEXT,
    "featuresEn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInquiry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "projectId" INTEGER,
    "projectTitle" TEXT,
    "unitId" TEXT,
    "unitNumber" TEXT,
    "interestType" TEXT NOT NULL,
    "interestTypeAr" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "statusAr" TEXT NOT NULL DEFAULT 'Ï¼Ï»┘èÏ»',

    CONSTRAINT "CustomerInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryItem" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tags" TEXT NOT NULL,

    CONSTRAINT "CategoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "PropertyFloor" ADD CONSTRAINT "PropertyFloor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "PropertyFloor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInquiry" ADD CONSTRAINT "CustomerInquiry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInquiry" ADD CONSTRAINT "CustomerInquiry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

