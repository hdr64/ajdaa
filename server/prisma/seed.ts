import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as seedModule from './seed-data/projects.seed.ts';
import { publishSeedMedia, resolveUploadDir, toStoredMediaUrl } from './seed-media.ts';

const seedProjects = seedModule.properties;

const prisma = new PrismaClient();

const ADMIN_USERS = [
  {
    email: 'admin@ajdaa.sa',
    name: 'سلطان المقرن',
    role: 'super_admin',
    roleAr: 'مدير عام النظام (Super Admin)',
    department: 'الإدارة التنفيذية',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: true,
    },
  },
  {
    email: 'f.sudairy@ajdaa.sa',
    name: 'م. فهد السديري',
    role: 'project_manager',
    roleAr: 'مدير التطوير والمشاريع',
    department: 'التطوير الهندسي',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: false,
    },
  },
  {
    email: 'reem.q@ajdaa.sa',
    name: 'ريم القحطاني',
    role: 'sales_agent',
    roleAr: 'مسؤول تأجير ومبيعات',
    department: 'إدارة الاستثمار والمبيعات',
    permissions: {
      manageProjects: false,
      manageUnits: true,
      viewInquiries: true,
      exportData: false,
      manageUsers: false,
    },
  },
  {
    email: 'turki.d@ajdaa.sa',
    name: 'تركي الدوسري',
    role: 'viewer',
    roleAr: 'محلل استثماري ومتابع',
    department: 'التخطيط والتحليل',
    permissions: {
      manageProjects: false,
      manageUnits: false,
      viewInquiries: true,
      exportData: true,
      manageUsers: false,
    },
  },
];

const CATEGORIES = [
  {
    id: 'cat-commercial',
    nameAr: 'مجمعات ومراكز تجارية',
    nameEn: 'Commercial Complexes & Centers',
    type: 'commercial',
    tags: ['طريق الملك فهد', 'واجهات زجاجية', 'صالات عرض', 'معارض تجارية', 'مطاعم وكافيهات'],
  },
  {
    id: 'cat-office',
    nameAr: 'مباني وأبراج إدارية',
    nameEn: 'Corporate Buildings & Towers',
    type: 'office',
    tags: ['مقرات شركات', 'مكاتب تنفيذية', 'قاعات مؤتمرات', 'تراسات خارجية', 'ألياف بصرية'],
  },
  {
    id: 'cat-logistics',
    nameAr: 'مستودعات ومخازن لوجستية',
    nameEn: 'Logistics Hubs & Warehouses',
    type: 'logistics',
    tags: ['سلاسل إمداد', 'مستودعات مبردة', 'أرصفة هيدروليكية', 'شحن وتفريغ', 'أمن 24/7'],
  },
  {
    id: 'cat-residential',
    nameAr: 'مجمعات سكنية فاخرة',
    nameEn: 'Luxury Residential Compounds',
    type: 'residential',
    tags: ['شقق فاخرة', 'أدوار متكررة', 'بنتهاوس', 'مسابح وحدائق', 'مواقف خاصة'],
  },
  {
    id: 'cat-hotel',
    nameAr: 'فنادق وأجنحة فندقية',
    nameEn: 'Hotels & Hotel Suites',
    type: 'hotel',
    tags: ['أجنحة فندقية', 'غرف ضيافة', 'مرافق رياضية', 'مطاعم', 'واي فاي مجاني'],
  },
];

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'password';

function toJsonArray(value: string[] | undefined): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

async function seedAdminUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  for (const user of ADMIN_USERS) {
    await prisma.adminUser.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
        roleAr: user.roleAr,
        department: user.department,
        permissions: JSON.stringify(user.permissions),
        status: 'active',
      },
    });
  }

  console.log(`✓ Admin users seeded (${ADMIN_USERS.length}) — default password: "${ADMIN_PASSWORD}"`);
}

async function seedCategories(): Promise<void> {
  for (const cat of CATEGORIES) {
    await prisma.categoryItem.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
        type: cat.type,
        tags: JSON.stringify(cat.tags),
      },
    });
  }

  console.log(`✓ Categories seeded (${CATEGORIES.length})`);
}

async function seedProjectData(): Promise<void> {
  const resetProjects = process.env.SEED_RESET_PROJECTS === '1';
  const existingProjects = await prisma.project.count();

  // Admins edit projects through /admin/dashboard, so a second seed run must never
  // wipe their work. SEED_RESET_PROJECTS=1 is the explicit opt-in to that.
  if (existingProjects > 0 && !resetProjects) {
    console.log(
      `Projects already present (${existingProjects}) — skipping project seed. ` +
        'Set SEED_RESET_PROJECTS=1 to wipe and reseed.'
    );
    return;
  }

  if (resetProjects) {
    await prisma.project.deleteMany({});
    await prisma.propertyFloor.deleteMany({});
    await prisma.propertyUnit.deleteMany({});
  }

  // Seed images are frontend asset paths (relative to src/); Vite content-hashes
  // them in production builds, so they are copied into UPLOAD_DIR and stored as
  // /uploads/seed/... URLs that the API actually serves.
  const media = publishSeedMedia(seedProjects, resolveUploadDir());
  if (media.copied > 0 || media.skipped > 0) {
    console.log(
      `✓ Seed media prepared — ${media.copied} copied / ${media.skipped} already up to date`
    );
  }

  for (const p of seedProjects) {
    await prisma.project.create({
      data: {
        id: p.id,
        type: p.type,
        typeAr: p.typeAr,
        typeEn: p.typeEn,
        title: p.title,
        titleEn: p.titleEn,
        price: p.price,
        priceLabel: p.priceLabel,
        priceType: p.priceType,
        priceTypeEn: p.priceTypeEn,
        status: p.status,
        statusEn: p.statusEn,
        publishStatus: 'published',
        publishedAt: new Date(),
        area: p.area,
        rooms: p.rooms ?? null,
        bathrooms: p.bathrooms ?? null,
        unitsCount: p.units,
        unitsCountEn: p.unitsEn,
        city: p.city,
        cityEn: p.cityEn,
        image: toStoredMediaUrl(p.image),
        gallery: toJsonArray(p.gallery?.map(toStoredMediaUrl)),
        description: p.description,
        descriptionEn: p.descriptionEn,
        badge: p.badge,
        badgeEn: p.badgeEn,
        features: toJsonArray(p.features),
        featuresEn: toJsonArray(p.featuresEn),
        videoUrl: p.videoUrl,
        virtualTour3dAvailable: p.virtualTour3dAvailable ?? false,
        locationHighlightsAr: toJsonArray(p.locationHighlightsAr),
        locationHighlightsEn: toJsonArray(p.locationHighlightsEn),
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        floors: {
          create: (p.floors ?? []).map((fl) => ({
            floorNumber: fl.floorNumber,
            floorNameAr: fl.floorNameAr,
            floorNameEn: fl.floorNameEn,
            descriptionAr: fl.descriptionAr,
            descriptionEn: fl.descriptionEn,
            totalArea: fl.totalArea,
            units: {
              create: fl.units.map((u) => ({
                id: u.id,
                unitNumber: u.unitNumber,
                floorNumber: u.floorNumber,
                floorNameAr: u.floorNameAr,
                floorNameEn: u.floorNameEn,
                sectionAr: u.sectionAr,
                type: u.type,
                typeAr: u.typeAr,
                typeEn: u.typeEn,
                area: u.area,
                priceLabel: u.priceLabel,
                status: u.status,
                statusAr: u.statusAr,
                statusEn: u.statusEn,
                features: toJsonArray(u.features),
                featuresEn: toJsonArray(u.featuresEn),
              })),
            },
          })),
        },
      },
    });
  }

  const counts = await prisma.$transaction([
    prisma.project.count(),
    prisma.propertyFloor.count(),
    prisma.propertyUnit.count(),
  ]);
  console.log(`✓ Projects seeded — ${counts[0]} projects / ${counts[1]} floors / ${counts[2]} units`);
}

async function main(): Promise<void> {
  await seedAdminUsers();
  await seedCategories();
  await seedProjectData();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });