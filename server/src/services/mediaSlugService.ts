import crypto from 'crypto';
import { prisma } from './prisma.js';

/**
 * Every library file has one permanent public slug: `/f/<slug>`, and
 * `/html/<slug>/` for HTML pages and sites. The slug is generated once and never
 * changes on its own (moving or renaming the file keeps it); only an admin can edit it.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 80;

/** Words the public router (or the SPA) could confuse with a slug. */
const RESERVED = new Set(['api', 'assets', 'uploads', 'admin', 'f', 'html']);

export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return `Slug must be ${SLUG_MIN}-${SLUG_MAX} characters`;
  if (!SLUG_PATTERN.test(slug)) return 'Slug may only contain lowercase letters, digits and single hyphens';
  if (RESERVED.has(slug)) return 'This slug is reserved';
  return null;
}

/** `Tower View 2.mp4` -> `tower-view-2` (ASCII only; Arabic names fall back to `file`). */
export function slugBase(name: string): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return base.length >= 2 ? base : 'file';
}

/** Returns a slug that no library file uses yet: readable base + random suffix. */
export async function generateUniqueSlug(originalName: string): Promise<string> {
  const base = slugBase(originalName);
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    const taken = await prisma.mediaFile.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 12)}`;
}

/** Gives a slug to rows that predate the column (or were indexed from disk). */
export async function backfillMissingSlugs(): Promise<number> {
  const missing = await prisma.mediaFile.findMany({
    where: { slug: null },
    select: { id: true, originalName: true },
  });
  for (const row of missing) {
    await prisma.mediaFile.update({
      where: { id: row.id },
      data: { slug: await generateUniqueSlug(row.originalName) },
    });
  }
  return missing.length;
}
