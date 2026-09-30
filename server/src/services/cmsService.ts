import { prisma } from './prisma.js';
import {
  SECTION_SCHEMAS,
  cmsClientItemSchema,
  type CmsNavItem,
  type CmsFooterSection,
  type CmsHomePageContent,
  type CmsWorksPageContent,
  type CmsClientsPageContent,
  type CmsContactPageContent,
} from '../schemas/cms.schema.js';
import {
  DEFAULT_NAV,
  DEFAULT_FOOTER,
  DEFAULT_HOME,
  DEFAULT_WORKS,
  DEFAULT_CLIENTS_PAGE,
  DEFAULT_CLIENTS,
  DEFAULT_CONTACT,
} from '../config/defaultCmsContent.js';

interface CacheEntry<T> {
  data: T;
  version: number;
  updatedAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function invalidateCmsCache(key?: string) {
  if (key) {
    memoryCache.delete(key);
  } else {
    memoryCache.clear();
  }
  memoryCache.delete('aggregated');
}

/** Seeds database with complete default content if tables are fresh. */
export async function seedCmsDefaultsIfNeeded() {
  const sectionsCount = await prisma.cmsSection.count();
  if (sectionsCount === 0) {
    const defaultSections: Record<string, unknown> = {
      nav: DEFAULT_NAV,
      footer: DEFAULT_FOOTER,
      home: DEFAULT_HOME,
      works: DEFAULT_WORKS,
      clientsPage: DEFAULT_CLIENTS_PAGE,
      contact: DEFAULT_CONTACT,
    };

    for (const [key, content] of Object.entries(defaultSections)) {
      await prisma.cmsSection.create({
        data: {
          key,
          content: JSON.stringify(content),
          version: 1,
        },
      });
      await prisma.cmsSectionVersion.create({
        data: {
          sectionKey: key,
          content: JSON.stringify(content),
          version: 1,
        },
      });
    }
  }

  const clientsCount = await prisma.cmsClient.count();
  if (clientsCount === 0) {
    for (const client of DEFAULT_CLIENTS) {
      await prisma.cmsClient.create({
        data: {
          nameAr: client.nameAr,
          nameEn: client.nameEn,
          sectorAr: client.sectorAr,
          sectorEn: client.sectorEn,
          descAr: client.descAr,
          descEn: client.descEn,
          logo: client.logo,
          tagsAr: JSON.stringify(client.tagsAr),
          tagsEn: JSON.stringify(client.tagsEn),
          websiteUrl: client.websiteUrl || null,
          order: client.order,
          visible: client.visible,
        },
      });
    }
  }
}

/** Prunes older snapshots to keep the last `keepCount` (default: 10). */
async function pruneOldVersions(sectionKey: string, keepCount = 10) {
  const versions = await prisma.cmsSectionVersion.findMany({
    where: { sectionKey },
    orderBy: { version: 'desc' },
    skip: keepCount,
    select: { id: true },
  });

  if (versions.length > 0) {
    await prisma.cmsSectionVersion.deleteMany({
      where: { id: { in: versions.map((v) => v.id) } },
    });
  }
}

export interface AggregatedCmsPayload {
  nav: CmsNavItem[];
  footer: CmsFooterSection;
  home: CmsHomePageContent;
  works: CmsWorksPageContent;
  clientsPage: CmsClientsPageContent;
  contact: CmsContactPageContent;
}

export async function getAggregatedCmsContent(): Promise<{
  payload: AggregatedCmsPayload;
  etag: string;
  version: number;
}> {
  const cached = memoryCache.get('aggregated') as CacheEntry<AggregatedCmsPayload> | undefined;
  if (cached) {
    const etag = `W/"cms-agg-v${cached.version}-${cached.updatedAt}"`;
    return { payload: cached.data, etag, version: cached.version };
  }

  await seedCmsDefaultsIfNeeded();

  const sections = await prisma.cmsSection.findMany();
  const sectionMap: Record<string, { content: unknown; version: number; updatedAt: Date }> = {};
  let maxVersion = 1;
  let latestTime = 0;

  for (const s of sections) {
    try {
      sectionMap[s.key] = {
        content: JSON.parse(s.content),
        version: s.version,
        updatedAt: s.updatedAt,
      };
      if (s.version > maxVersion) maxVersion = s.version;
      const t = s.updatedAt.getTime();
      if (t > latestTime) latestTime = t;
    } catch {
      // Fallback on corrupt JSON
    }
  }

  const payload: AggregatedCmsPayload = {
    nav: (sectionMap.nav?.content as CmsNavItem[]) ?? DEFAULT_NAV,
    footer: (sectionMap.footer?.content as CmsFooterSection) ?? DEFAULT_FOOTER,
    home: (sectionMap.home?.content as CmsHomePageContent) ?? DEFAULT_HOME,
    works: (sectionMap.works?.content as CmsWorksPageContent) ?? DEFAULT_WORKS,
    clientsPage: (sectionMap.clientsPage?.content as CmsClientsPageContent) ?? DEFAULT_CLIENTS_PAGE,
    contact: (sectionMap.contact?.content as CmsContactPageContent) ?? DEFAULT_CONTACT,
  };

  memoryCache.set('aggregated', {
    data: payload,
    version: maxVersion,
    updatedAt: latestTime,
  });

  const etag = `W/"cms-agg-v${maxVersion}-${latestTime}"`;
  return { payload, etag, version: maxVersion };
}

export async function getSectionContent(key: string): Promise<{
  data: unknown;
  etag: string;
  version: number;
} | null> {
  const cached = memoryCache.get(key);
  if (cached) {
    return {
      data: cached.data,
      etag: `W/"sec-${key}-v${cached.version}-${cached.updatedAt}"`,
      version: cached.version,
    };
  }

  const section = await prisma.cmsSection.findUnique({ where: { key } });
  if (!section) return null;

  const data = JSON.parse(section.content);
  memoryCache.set(key, {
    data,
    version: section.version,
    updatedAt: section.updatedAt.getTime(),
  });

  return {
    data,
    etag: `W/"sec-${key}-v${section.version}-${section.updatedAt.getTime()}"`,
    version: section.version,
  };
}

export async function updateSectionContent(
  key: string,
  rawContent: unknown,
  adminId: string,
  io?: { emit: (event: string, data: unknown) => void }
) {
  const schema = SECTION_SCHEMAS[key];
  if (!schema) {
    throw new Error(`Unknown CMS section key: ${key}`);
  }

  const validated = schema.parse(rawContent);

  // Referential Integrity: if works page has featuredProjectId, check it exists
  if (key === 'works') {
    const worksContent = validated as CmsWorksPageContent;
    if (worksContent.featuredProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: worksContent.featuredProjectId },
      });
      if (!project) {
        throw new Error(`Featured project #${worksContent.featuredProjectId} does not exist.`);
      }
    }
  }

  const stringified = JSON.stringify(validated);

  const existing = await prisma.cmsSection.findUnique({ where: { key } });
  const newVersion = (existing?.version ?? 0) + 1;

  const updated = await prisma.$transaction(async (tx) => {
    const sec = await tx.cmsSection.upsert({
      where: { key },
      create: {
        key,
        content: stringified,
        version: 1,
        updatedById: adminId,
      },
      update: {
        content: stringified,
        version: newVersion,
        updatedById: adminId,
      },
    });

    await tx.cmsSectionVersion.create({
      data: {
        sectionKey: key,
        content: stringified,
        version: sec.version,
        createdById: adminId,
      },
    });

    return sec;
  });

  await pruneOldVersions(key, 10);
  invalidateCmsCache(key);

  if (io) {
    io.emit('cms:updated', { key, version: updated.version, timestamp: Date.now() });
  }

  return {
    data: validated,
    version: updated.version,
    updatedAt: updated.updatedAt,
  };
}

export async function getSectionVersions(key: string) {
  const versions = await prisma.cmsSectionVersion.findMany({
    where: { sectionKey: key },
    orderBy: { version: 'desc' },
    take: 10,
  });

  return versions.map((v) => ({
    id: v.id,
    version: v.version,
    createdAt: v.createdAt,
    createdById: v.createdById,
    content: JSON.parse(v.content),
  }));
}

export async function rollbackSectionVersion(
  key: string,
  targetVersion: number,
  adminId: string,
  io?: { emit: (event: string, data: unknown) => void }
) {
  const snapshot = await prisma.cmsSectionVersion.findUnique({
    where: {
      sectionKey_version: { sectionKey: key, version: targetVersion },
    },
  });

  if (!snapshot) {
    throw new Error(`Version ${targetVersion} for section ${key} not found.`);
  }

  const restoredContent = JSON.parse(snapshot.content);
  return updateSectionContent(key, restoredContent, adminId, io);
}

// ----------------- Client / Partner CRUD -----------------

export async function getCmsClients(onlyVisible = true) {
  await seedCmsDefaultsIfNeeded();
  const clients = await prisma.cmsClient.findMany({
    where: onlyVisible ? { visible: true } : undefined,
    orderBy: { order: 'asc' },
  });

  return clients.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    sectorAr: c.sectorAr,
    sectorEn: c.sectorEn,
    descAr: c.descAr,
    descEn: c.descEn,
    logo: c.logo,
    tagsAr: JSON.parse(c.tagsAr || '[]') as string[],
    tagsEn: JSON.parse(c.tagsEn || '[]') as string[],
    websiteUrl: c.websiteUrl,
    order: c.order,
    visible: c.visible,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function createCmsClient(rawInput: unknown, io?: { emit: (event: string, data: unknown) => void }) {
  const validated = cmsClientItemSchema.parse(rawInput);

  const highest = await prisma.cmsClient.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (highest?.order ?? 0) + 1;

  const client = await prisma.cmsClient.create({
    data: {
      nameAr: validated.nameAr,
      nameEn: validated.nameEn,
      sectorAr: validated.sectorAr,
      sectorEn: validated.sectorEn,
      descAr: validated.descAr,
      descEn: validated.descEn,
      logo: validated.logo,
      tagsAr: JSON.stringify(validated.tagsAr),
      tagsEn: JSON.stringify(validated.tagsEn),
      websiteUrl: validated.websiteUrl || null,
      order: validated.order ?? nextOrder,
      visible: validated.visible ?? true,
    },
  });

  if (io) io.emit('cms:clients:updated', { action: 'create', id: client.id });
  return client;
}

export async function updateCmsClient(id: string, rawInput: unknown, io?: { emit: (event: string, data: unknown) => void }) {
  const validated = cmsClientItemSchema.parse(rawInput);

  const client = await prisma.cmsClient.update({
    where: { id },
    data: {
      nameAr: validated.nameAr,
      nameEn: validated.nameEn,
      sectorAr: validated.sectorAr,
      sectorEn: validated.sectorEn,
      descAr: validated.descAr,
      descEn: validated.descEn,
      logo: validated.logo,
      tagsAr: JSON.stringify(validated.tagsAr),
      tagsEn: JSON.stringify(validated.tagsEn),
      websiteUrl: validated.websiteUrl || null,
      order: validated.order,
      visible: validated.visible,
    },
  });

  if (io) io.emit('cms:clients:updated', { action: 'update', id: client.id });
  return client;
}

export async function deleteCmsClient(id: string, io?: { emit: (event: string, data: unknown) => void }) {
  const deleted = await prisma.cmsClient.delete({ where: { id } });
  if (io) io.emit('cms:clients:updated', { action: 'delete', id });
  return deleted;
}

export async function reorderCmsClients(orderedIds: string[], io?: { emit: (event: string, data: unknown) => void }) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.cmsClient.update({
        where: { id },
        data: { order: index + 1 },
      })
    )
  );

  if (io) io.emit('cms:clients:updated', { action: 'reorder' });
  return { success: true };
}

export async function bulkDeleteCmsClients(ids: string[], io?: { emit: (event: string, data: unknown) => void }) {
  const result = await prisma.cmsClient.deleteMany({
    where: { id: { in: ids } },
  });

  if (io) io.emit('cms:clients:updated', { action: 'bulk-delete', count: result.count });
  return result;
}

export async function bulkSetCmsClientsVisibility(ids: string[], visible: boolean, io?: { emit: (event: string, data: unknown) => void }) {
  const result = await prisma.cmsClient.updateMany({
    where: { id: { in: ids } },
    data: { visible },
  });

  if (io) io.emit('cms:clients:updated', { action: 'bulk-visibility', count: result.count });
  return result;
}
