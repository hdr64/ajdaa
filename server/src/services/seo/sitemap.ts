import { absoluteUrl, escapeHtml } from './escape.js';
import { STATIC_PAGES, type PageKey } from './pages.js';
import { projectPath } from './slug.js';

export interface SitemapProject {
  id: number;
  titleEn?: string | null;
  image: string;
  updatedAt: Date;
}

export function buildRobotsTxt(indexing: boolean, origin: string): string {
  if (!indexing) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Allow: /uploads/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(
  origin: string,
  projects: SitemapProject[],
  options: { indexing: boolean; includeCareers: boolean },
): string {
  const head =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  if (!options.indexing) return `${head}</urlset>\n`;

  const keys: PageKey[] = ['home', 'works', 'clients', 'pastWorks', 'careers', 'booking', 'contact'];
  const entries: string[] = [];
  for (const key of keys) {
    if (key === 'careers' && !options.includeCareers) continue;
    const arPath = STATIC_PAGES[key].path;
    const enPath = STATIC_PAGES[key].path === '/' ? '/en' : `/en${STATIC_PAGES[key].path}`;
    const arUrl = escapeHtml(origin + arPath);
    const enUrl = escapeHtml(origin + enPath);
    const xhtmlLinks =
      `    <xhtml:link rel="alternate" hreflang="ar" href="${arUrl}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>`;

    entries.push(`  <url>\n    <loc>${arUrl}</loc>\n${xhtmlLinks}\n  </url>`);
    entries.push(`  <url>\n    <loc>${enUrl}</loc>\n${xhtmlLinks}\n  </url>`);
  }
  for (const project of projects) {
    const arPath = projectPath(project.id, project.titleEn, 'ar');
    const enPath = projectPath(project.id, project.titleEn, 'en');
    const arUrl = escapeHtml(`${origin}${arPath}`);
    const enUrl = escapeHtml(`${origin}${enPath}`);
    const image = absoluteUrl(origin, project.image);
    const imageTag = image ? `\n    <image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>` : '';
    const lastmodTag = `\n    <lastmod>${project.updatedAt.toISOString()}</lastmod>`;
    const xhtmlLinks =
      `    <xhtml:link rel="alternate" hreflang="ar" href="${arUrl}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>`;

    entries.push(`  <url>\n    <loc>${arUrl}</loc>${lastmodTag}${imageTag}\n${xhtmlLinks}\n  </url>`);
    entries.push(`  <url>\n    <loc>${enUrl}</loc>${lastmodTag}${imageTag}\n${xhtmlLinks}\n  </url>`);
  }
  return `${head}${entries.join('\n')}\n</urlset>\n`;
}
