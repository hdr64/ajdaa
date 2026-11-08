import { prisma } from './prisma.js';

export interface MediaUsageItem {
  entityType: 'project' | 'pastProject' | 'cmsClient' | 'cmsSection' | 'adminUser' | 'developerNote' | 'appSetting';
  entityId: string | number;
  entityTitle: string;
  field: 'image' | 'gallery' | 'brochureUrl' | 'model3dUrl' | 'pdfUrl' | 'logo' | 'content' | 'avatar' | 'screenshotUrl' | 'value';
}

export interface MediaUsageResult {
  mediaId?: string;
  url: string;
  filename: string;
  usageCount: number;
  usages: MediaUsageItem[];
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function cleanFilename(input: string): string {
  const parts = input.split('/');
  return parts[parts.length - 1].toLowerCase().trim();
}

/**
 * Returns an aggregated map of all media referenced anywhere in the system.
 * Keyed by lowercase filename (e.g. "uuid.webp") for rapid O(1) matching.
 */
export async function getBatchMediaUsage(): Promise<Map<string, MediaUsageItem[]>> {
  const usageMap = new Map<string, MediaUsageItem[]>();

  const addUsage = (target: string | null | undefined, item: MediaUsageItem) => {
    if (!target) return;
    const key = cleanFilename(target);
    if (!key) return;
    const existing = usageMap.get(key) ?? [];
    existing.push(item);
    usageMap.set(key, existing);
  };

  // 1. Current Projects
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, image: true, gallery: true, brochureUrl: true, model3dUrl: true },
  });

  for (const p of projects) {
    if (p.image) addUsage(p.image, { entityType: 'project', entityId: p.id, entityTitle: p.title, field: 'image' });
    if (p.brochureUrl) addUsage(p.brochureUrl, { entityType: 'project', entityId: p.id, entityTitle: p.title, field: 'brochureUrl' });
    if (p.model3dUrl) addUsage(p.model3dUrl, { entityType: 'project', entityId: p.id, entityTitle: p.title, field: 'model3dUrl' });
    for (const g of parseJsonArray(p.gallery)) {
      addUsage(g, { entityType: 'project', entityId: p.id, entityTitle: p.title, field: 'gallery' });
    }
  }

  // 2. Past Projects
  const pastProjects = await prisma.pastProject.findMany({
    select: { id: true, title: true, image: true, gallery: true, pdfUrl: true },
  });

  for (const pp of pastProjects) {
    if (pp.image) addUsage(pp.image, { entityType: 'pastProject', entityId: pp.id, entityTitle: pp.title, field: 'image' });
    if (pp.pdfUrl) addUsage(pp.pdfUrl, { entityType: 'pastProject', entityId: pp.id, entityTitle: pp.title, field: 'pdfUrl' });
    for (const g of parseJsonArray(pp.gallery)) {
      addUsage(g, { entityType: 'pastProject', entityId: pp.id, entityTitle: pp.title, field: 'gallery' });
    }
  }

  // 3. CMS Corporate Clients
  const clients = await prisma.cmsClient.findMany({
    select: { id: true, nameAr: true, logo: true },
  });

  for (const c of clients) {
    if (c.logo) addUsage(c.logo, { entityType: 'cmsClient', entityId: c.id, entityTitle: c.nameAr, field: 'logo' });
  }

  // 4. Admin Users Avatar
  const users = await prisma.adminUser.findMany({
    select: { id: true, name: true, avatar: true },
  });

  for (const u of users) {
    if (u.avatar) addUsage(u.avatar, { entityType: 'adminUser', entityId: u.id, entityTitle: u.name, field: 'avatar' });
  }

  // 5. Developer Notes (Screenshots)
  const devNotes = await prisma.developerNote.findMany({
    select: { id: true, title: true, screenshotUrl: true },
  });

  for (const dn of devNotes) {
    if (dn.screenshotUrl) addUsage(dn.screenshotUrl, { entityType: 'developerNote', entityId: dn.id, entityTitle: dn.title, field: 'screenshotUrl' });
  }

  // 6. App Settings (e.g. logos or branding images stored in JSON settings)
  const appSettings = await prisma.appSetting.findMany({
    select: { key: true, value: true },
  });

  // 7. CMS Sections JSON Content
  const cmsSections = await prisma.cmsSection.findMany({
    select: { key: true, content: true },
  });

  // Check all known media files for exact token appearance in CMS or AppSettings
  const mediaFiles = await prisma.mediaFile.findMany({
    select: { filename: true },
  });

  for (const mf of mediaFiles) {
    const fn = mf.filename.toLowerCase();
    const token = `/uploads/${fn}`;

    for (const sec of cmsSections) {
      if (sec.content && (sec.content.toLowerCase().includes(token) || sec.content.toLowerCase().includes(`"${fn}"`))) {
        const existing = usageMap.get(fn) ?? [];
        existing.push({
          entityType: 'cmsSection',
          entityId: sec.key,
          entityTitle: `قسم CMS: ${sec.key}`,
          field: 'content',
        });
        usageMap.set(fn, existing);
      }
    }

    for (const setting of appSettings) {
      if (setting.value && (setting.value.toLowerCase().includes(token) || setting.value.toLowerCase().includes(`"${fn}"`))) {
        const existing = usageMap.get(fn) ?? [];
        existing.push({
          entityType: 'appSetting',
          entityId: setting.key,
          entityTitle: `إعدادات: ${setting.key}`,
          field: 'value',
        });
        usageMap.set(fn, existing);
      }
    }
  }

  return usageMap;
}

/**
 * Checks usage for a specific media URL or filename.
 */
export async function inspectMediaUsage(targetUrl: string): Promise<MediaUsageResult> {
  const filename = cleanFilename(targetUrl);

  const mediaFile = await prisma.mediaFile.findFirst({
    where: {
      OR: [
        { url: targetUrl },
        { filename },
        { url: { endsWith: filename } },
      ],
    },
  });

  const batch = await getBatchMediaUsage();
  const usages = batch.get(filename) ?? [];

  return {
    mediaId: mediaFile?.id,
    url: mediaFile?.url ?? targetUrl,
    filename: mediaFile?.filename ?? filename,
    usageCount: usages.length,
    usages,
  };
}
