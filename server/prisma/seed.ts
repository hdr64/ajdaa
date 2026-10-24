import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as seedModule from './seed-data/projects.seed.ts';
import { publishSeedMedia, resolveUploadDir, toStoredMediaUrl } from './seed-media.ts';
import { meetsPasswordPolicy } from '../src/services/passwordPolicy.js';

const seedProjects = seedModule.properties;

const prisma = new PrismaClient();

const ADMIN_USERS = [
  {
    email: 'admin@ajdaa.sa',
    name: 'admin',
    role: 'super_admin',
    roleAr: 'مدير عام النظام (Super Admin)',
    department: 'الإدارة التنفيذية',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: true,
      verifyUsers: true,
    },
  },
    {
    email: 'dev@ajdaa.sa',
    name: 'developer',
    role: 'project_manager',
    roleAr: 'مدير التطوير والمشاريع',
    department: 'التطوير الهندسي',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: true,
      manageUsers: true,
      verifyUsers: true,
    },
  },
];

const FIXTURE_ADMIN_USERS = [
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
      verifyUsers: true,
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
      verifyUsers: false,
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
      verifyUsers: false,
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
      verifyUsers: false,
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

/**
 * The password the seeded admin accounts receive.
 *
 * In production the seed refuses to run without an explicit
 * `SEED_ADMIN_PASSWORD` that satisfies the password policy: a default
 * password in a production database is a published credential. In development
 * and test the default stays, so a fresh checkout works out of the box — it is
 * a development fixture and must never reach a deployment.
 */
const DEFAULT_SEED_PASSWORD = 'password';

function resolveSeedPassword(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!configured) {
    if (isProduction) {
      throw new Error(
        '[seed] SEED_ADMIN_PASSWORD is required in production. ' +
          'Set it to a value of at least 10 characters containing a letter and a digit ' +
          '(e.g. `openssl rand -base64 18`).'
      );
    }
    return DEFAULT_SEED_PASSWORD;
  }

  if (isProduction && !meetsPasswordPolicy(configured)) {
    throw new Error(
      '[seed] SEED_ADMIN_PASSWORD does not meet the password policy: ' +
        'it needs at least 10 characters, one letter and one digit.'
    );
  }

  return configured;
}

const SEED_ROLES = [
  {
    id: 'role_super_admin',
    key: 'super_admin',
    nameAr: 'مدير عام النظام (Super Admin)',
    nameEn: 'Super Admin',
    description: 'Full system access and user management',
    permissions: JSON.stringify([
      'manageProjects',
      'manageUnits',
      'viewInquiries',
      'viewApplications',
      'manageApplications',
      'managePastProjects',
      'exportData',
      'manageUsers',
      'verifyUsers',
    ]),
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: 'role_project_manager',
    key: 'project_manager',
    nameAr: 'مدير التطوير والمشاريع',
    nameEn: 'Project Manager',
    description: 'Project and unit management',
    permissions: JSON.stringify(['manageProjects', 'manageUnits', 'viewInquiries', 'exportData']),
    isSystem: false,
    sortOrder: 2,
  },
  {
    id: 'role_sales_agent',
    key: 'sales_agent',
    nameAr: 'مسؤول تأجير ومبيعات',
    nameEn: 'Sales Agent',
    description: 'Unit management and inquiry handling',
    permissions: JSON.stringify(['manageUnits', 'viewInquiries']),
    isSystem: false,
    sortOrder: 3,
  },
  {
    id: 'role_viewer',
    key: 'viewer',
    nameAr: 'محلل استثماري ومتابع',
    nameEn: 'Viewer',
    description: 'View inquiries and export data',
    permissions: JSON.stringify(['viewInquiries', 'exportData']),
    isSystem: false,
    sortOrder: 4,
  },
];

function deptId(nameAr: string): string {
  return 'dept_' + crypto.createHash('md5').update(nameAr).digest('hex');
}

const SEED_DEPARTMENTS = [
  {
    id: deptId('الإدارة التنفيذية'),
    nameAr: 'الإدارة التنفيذية',
    nameEn: 'Executive Management',
  },
  {
    id: deptId('التطوير الهندسي'),
    nameAr: 'التطوير الهندسي',
    nameEn: 'Engineering & Development',
  },
  {
    id: deptId('إدارة الاستثمار والمبيعات'),
    nameAr: 'إدارة الاستثمار والمبيعات',
    nameEn: 'Investment & Sales',
  },
  {
    id: deptId('التخطيط والتحليل'),
    nameAr: 'التخطيط والتحليل',
    nameEn: 'Planning & Analysis',
  },
];

function toJsonArray(value: string[] | undefined): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

async function seedRoles(): Promise<void> {
  for (const role of SEED_ROLES) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        key: role.key,
        nameAr: role.nameAr,
        nameEn: role.nameEn,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        sortOrder: role.sortOrder,
      },
      create: role,
    });
  }
}

async function seedDepartments(): Promise<void> {
  for (const dept of SEED_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { nameAr: dept.nameAr },
      update: {
        nameEn: dept.nameEn,
      },
      create: dept,
    });
  }
}

async function seedAdminUsers(adminPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const usersMap = new Map<string, (typeof ADMIN_USERS)[number]>();
  for (const user of ADMIN_USERS) {
    usersMap.set(user.email, user);
  }
  if (process.env.SEED_TEST_FIXTURES === '1') {
    for (const user of FIXTURE_ADMIN_USERS) {
      usersMap.set(user.email, user);
    }
  }
  const usersToSeed = Array.from(usersMap.values());

  for (const user of usersToSeed) {
    const roleId = `role_${user.role}`;
    const departmentId = user.department ? deptId(user.department) : null;

    await prisma.adminUser.upsert({
      where: { email: user.email },
      update: {
        roleId,
        departmentId,
        role: user.role,
        roleAr: user.roleAr,
        department: user.department,
        name: user.name,
        permissions: JSON.stringify(user.permissions),
      },
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
        roleAr: user.roleAr,
        roleId,
        department: user.department,
        departmentId,
        permissions: JSON.stringify(user.permissions),
        status: 'active',
        // Seeded accounts predate the email-verification flow: treat them as
        // already verified so they are not locked out by the new rule.
        emailVerifiedAt: new Date(),
      },
    });
  }

  // The password is only echoed outside production: a production log file
  // must never contain a working credential.
  const passwordNote =
    process.env.NODE_ENV === 'production' ? '' : ` — default password: "${adminPassword}"`;
  console.log(`✓ Admin users seeded (${usersToSeed.length})${passwordNote}`);
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
  // The password is resolved before anything is written: a production seed
  // that is refused must not leave half-seeded data behind.
  const adminPassword = resolveSeedPassword();

  await seedRoles();
  await seedDepartments();
  await seedAdminUsers(adminPassword);
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