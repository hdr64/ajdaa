import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { getSiteSettings } from '../siteSettings.js';
import { buildMeta, ROBOTS_NOINDEX, type MetaContext } from './meta.js';
import { matchRoute, normalizePath } from './pages.js';
import { renderShell } from './shell.js';
import { buildRobotsTxt, buildSitemapXml } from './sitemap.js';

const SHELL_TTL_MS = 60_000;
const SHELL_MAX_ENTRIES = 500;
const SITEMAP_TTL_MS = 10 * 60_000;

export interface ShellResult {
  status: 200 | 404;
  html: string;
  etag: string;
  robots: string;
}

let templateCache: { file: string; mtimeMs: number; html: string } | null = null;
const shellCache = new Map<string, { at: number; value: ShellResult }>();
let sitemapCache: { at: number; key: string; xml: string } | null = null;

export function clearSeoCache(): void {
  templateCache = null;
  shellCache.clear();
  sitemapCache = null;
}

/** Reads `index.html` of the built SPA; re-reads it when the file changes (a deploy) without a restart. */
async function loadTemplate(): Promise<string> {
  const file = path.join(config.spaDistDir, 'index.html');
  const stat = await fs.stat(file);
  if (templateCache && templateCache.file === file && templateCache.mtimeMs === stat.mtimeMs) {
    return templateCache.html;
  }
  const html = await fs.readFile(file, 'utf8');
  templateCache = { file, mtimeMs: stat.mtimeMs, html };
  return html;
}

const PUBLISHED_PROJECT_LINKS = { id: true, title: true, titleEn: true, city: true } as const;

async function loadContext(route: ReturnType<typeof matchRoute>): Promise<MetaContext> {
  const base = { origin: config.appUrl, indexing: config.seoIndexing };
  if (route.kind === 'admin' || route.kind === 'notFound') {
    return { ...base, site: { phone: '', email: '', addressAr: '', socials: {} }, projects: [] };
  }
  if (route.kind === 'project') {
    const project = await prisma.project.findFirst({ where: { id: route.id, publishStatus: 'published' } });
    if (project) {
      // Admin-typed text often carries stray whitespace that would show in titles.
      project.title = project.title.trim();
      project.city = project.city.trim();
    }
    return { ...base, site: { phone: '', email: '', addressAr: '', socials: {} }, projects: [], project };
  }
  const needsSite = route.key === 'home';
  const needsProjects = route.key === 'home' || route.key === 'works';
  const [site, projects] = await Promise.all([
    needsSite ? getSiteSettings() : Promise.resolve(null),
    needsProjects
      ? prisma.project.findMany({
          where: { publishStatus: 'published' },
          select: PUBLISHED_PROJECT_LINKS,
          orderBy: { id: 'asc' },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  return {
    ...base,
    site: site
      ? { phone: site.phone, email: site.email, addressAr: site.addressAr, socials: site.socials }
      : { phone: '', email: '', addressAr: '', socials: {} },
    projects,
  };
}

export async function renderPage(rawPath: unknown): Promise<ShellResult> {
  const key = `${config.seoIndexing ? 'on' : 'off'}:${normalizePath(rawPath)}`;
  const hit = shellCache.get(key);
  if (hit && Date.now() - hit.at < SHELL_TTL_MS) return hit.value;

  const template = await loadTemplate();
  const route = matchRoute(rawPath);
  const meta = buildMeta(route, await loadContext(route));
  const html = renderShell(template, meta);
  const value: ShellResult = {
    status: meta.status,
    html,
    etag: `W/"${crypto.createHash('sha1').update(html).digest('hex').slice(0, 20)}"`,
    robots: meta.robots,
  };

  if (shellCache.size >= SHELL_MAX_ENTRIES) {
    const oldest = shellCache.keys().next().value;
    if (oldest !== undefined) shellCache.delete(oldest);
  }
  shellCache.set(key, { at: Date.now(), value });
  return value;
}

export async function renderSitemap(): Promise<string> {
  const key = config.seoIndexing ? 'on' : 'off';
  if (sitemapCache && sitemapCache.key === key && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) {
    return sitemapCache.xml;
  }
  let xml: string;
  if (!config.seoIndexing) {
    xml = buildSitemapXml(config.appUrl, [], { indexing: false, includeCareers: false });
  } else {
    const [projects, site] = await Promise.all([
      prisma.project.findMany({
        where: { publishStatus: 'published' },
        select: { id: true, titleEn: true, image: true, updatedAt: true },
        orderBy: { id: 'asc' },
      }),
      getSiteSettings(),
    ]);
    xml = buildSitemapXml(config.appUrl, projects, {
      indexing: true,
      includeCareers: site.careers.showFooterLink || site.careers.showFloatingButton,
    });
  }
  sitemapCache = { at: Date.now(), key, xml };
  return xml;
}

export function robotsTxt(): string {
  return buildRobotsTxt(config.seoIndexing, config.appUrl);
}

export { ROBOTS_NOINDEX };
