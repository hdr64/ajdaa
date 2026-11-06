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
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
  if (!options.indexing) return `${head}</urlset>\n`;

  const keys: PageKey[] = ['home', 'works', 'clients', 'pastWorks', 'careers', 'booking', 'contact'];
  const entries: string[] = [];
  for (const key of keys) {
    if (key === 'careers' && !options.includeCareers) continue;
    entries.push(`  <url><loc>${escapeHtml(origin + STATIC_PAGES[key].path)}</loc></url>`);
  }
  for (const project of projects) {
    const image = absoluteUrl(origin, project.image);
    const imageTag = image ? `<image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>` : '';
    entries.push(
      `  <url><loc>${escapeHtml(`${origin}${projectPath(project.id, project.titleEn)}`)}</loc>` +
        `<lastmod>${project.updatedAt.toISOString()}</lastmod>${imageTag}</url>`,
    );
  }
  return `${head}${entries.join('\n')}\n</urlset>\n`;
}
