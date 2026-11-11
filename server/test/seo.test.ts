import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { clearSeoCache } from '../src/services/seo/seoService.js';
import { jsonForScript, escapeHtml } from '../src/services/seo/escape.js';
import { buildRobotsTxt, buildSitemapXml } from '../src/services/seo/sitemap.js';
import { compact } from '../src/services/seo/jsonld.js';
import { projectPath, slugify } from '../src/services/seo/slug.js';
import { closeApp, getApp, inject } from './helpers.js';

const TEMPLATE =
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>old</title></head>' +
  '<body><div id="root"></div></body></html>';

const EVIL = '</script><script>alert(1)</script>"><img src=x onerror=1>';

let distDir: string;
let originalDist: string;
let originalIndexing: boolean;
let publishedId: number;
let noPriceId: number;
let draftId: number;
let evilId: number;

function projectData(title: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'commercial',
    typeAr: 'تجاري',
    title,
    titleEn: `${title} EN`,
    priceType: 'إيجار',
    area: 900,
    city: 'الرياض',
    image: '/uploads/seo/main.webp',
    gallery: JSON.stringify(['/uploads/seo/g1.webp']),
    features: JSON.stringify(['مواقف', 'أمن']),
    description: 'وصف المشروع التجاري في قلب الرياض.',
    lat: 24.7,
    lng: 46.6,
    publishStatus: 'published',
    publishedAt: new Date(),
    ...extra,
  };
}

function ldBlocks(html: string): unknown[] {
  return [...html.matchAll(/<script data-seo="1" type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]!),
  );
}

function shell(p: string) {
  return inject({ method: 'GET', url: `/api/seo/shell?path=${encodeURIComponent(p)}` });
}

beforeAll(async () => {
  await getApp();
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajda-seo-dist-'));
  fs.writeFileSync(path.join(distDir, 'index.html'), TEMPLATE);
  originalDist = config.spaDistDir;
  originalIndexing = config.seoIndexing;
  config.spaDistDir = distDir;

  publishedId = (await prisma.project.create({ data: projectData('برج السيف', { titleEn: 'Saif Tower', cityEn: 'Riyadh', price: 2500000, priceLabel: '2.5 مليون' }) })).id;
  noPriceId = (await prisma.project.create({ data: projectData('مجمع النخيل', { titleEn: null }) })).id;
  draftId = (await prisma.project.create({ data: projectData('مشروع سري مسودة', { publishStatus: 'draft' }) })).id;
  evilId = (await prisma.project.create({ data: projectData(EVIL) })).id;
});

beforeEach(() => {
  config.seoIndexing = true;
  clearSeoCache();
});

afterAll(async () => {
  config.spaDistDir = originalDist;
  config.seoIndexing = originalIndexing;
  clearSeoCache();
  await prisma.project.deleteMany({ where: { id: { in: [publishedId, noPriceId, draftId, evilId] } } });
  fs.rmSync(distDir, { recursive: true, force: true });
  await closeApp();
});

describe('SEO shell: static pages', () => {
  it('renders the home page head, JSON-LD and noscript content', async () => {
    const res = await shell('/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    const html = res.body;
    expect(html.match(/<title/g)).toHaveLength(1);
    expect(html).not.toContain('<title>old</title>');
    expect(html).toContain(`<link data-seo="1" rel="canonical" href="${config.appUrl}/" />`);
    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('index, follow');
    const types = ldBlocks(html).map((b) => (b as { '@type': string })['@type']);
    expect(types).toEqual(['RealEstateAgent', 'WebSite']);
    expect(html).toMatch(/<noscript><h1>[^<]+<\/h1>/);
    expect(html).toContain('<a href="/works">');
    expect(html).toContain(`<a href="/projects/saif-tower-${publishedId}">`);
  });

  it('canonicalises aliases, case and trailing slash', async () => {
    expect((await shell('/Register-Interest/')).body).toContain(`href="${config.appUrl}/booking"`);
    expect((await shell('/booking')).body).toContain(`href="${config.appUrl}/booking"`);
    expect((await shell('/project/' + publishedId)).body).toContain(
      `href="${config.appUrl}/projects/saif-tower-${publishedId}"`,
    );
  });

  it('emits a breadcrumb for inner pages', async () => {
    const blocks = ldBlocks((await shell('/clients')).body) as { '@type': string }[];
    expect(blocks.map((b) => b['@type'])).toEqual(['BreadcrumbList']);
  });

  it('is noindex with no social tags for admin routes', async () => {
    const res = await shell('/admin/projects');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.body).toContain('content="noindex, nofollow"');
    expect(res.body).not.toContain('og:');
    expect(res.body).not.toContain('ld+json');
  });

  it('answers 404 + noindex for unknown paths and invalid input', async () => {
    for (const p of ['/nope', '/projects/abc', '/projects/999999']) {
      const res = await shell(p);
      expect(res.statusCode).toBe(404);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
    const bad = await inject({ method: 'GET', url: '/api/seo/shell' });
    expect(bad.statusCode).toBe(404);
  });
});

describe('SEO shell: projects', () => {
  it('renders title, canonical, listing JSON-LD with an offer, and an absolute image', async () => {
    const res = await shell(`/projects/${publishedId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title data-seo="1">برج السيف — الرياض | أجدا العقارية</title>');
    expect(res.body).toContain(`property="og:image" content="${config.appUrl}/uploads/seo/main.webp"`);
    const [listing, crumbs] = ldBlocks(res.body) as Record<string, any>[];
    expect(listing!['@type']).toBe('RealEstateListing');
    expect(listing!.offers).toMatchObject({ price: 2500000, priceCurrency: 'SAR' });
    expect(listing!.image[0]).toBe(`${config.appUrl}/uploads/seo/main.webp`);
    expect(listing!.about.geo.latitude).toBe(24.7);
    expect(crumbs!['@type']).toBe('BreadcrumbList');
  });

  it('serves one project at the id, a wrong slug and the readable slug, all canonical to the slug URL', async () => {
    const canonical = `${config.appUrl}/projects/saif-tower-${publishedId}`;
    for (const p of [
      `/projects/${publishedId}`,
      `/project/${publishedId}`,
      `/projects/wrong-name-${publishedId}`,
      `/projects/saif-tower-${publishedId}`,
      `/Projects/Saif-Tower-${publishedId}/`,
    ]) {
      const res = await shell(p);
      expect(res.statusCode, p).toBe(200);
      expect(res.body, p).toContain(`<link data-seo="1" rel="canonical" href="${canonical}" />`);
      expect(res.body, p).toContain(`property="og:url" content="${canonical}"`);
      const [listing] = ldBlocks(res.body) as Record<string, unknown>[];
      expect(listing!.url).toBe(canonical);
    }
  });

  it('uses the plain id URL when the project has no English title', async () => {
    const res = await shell(`/projects/${noPriceId}`);
    expect(res.body).toContain(`rel="canonical" href="${config.appUrl}/projects/${noPriceId}"`);
  });

  it('omits the offer when there is no price', async () => {
    const [listing] = ldBlocks((await shell(`/projects/${noPriceId}`)).body) as Record<string, unknown>[];
    expect(listing).not.toHaveProperty('offers');
  });

  it('never leaks a draft project', async () => {
    const res = await shell(`/projects/${draftId}`);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('مشروع سري');
    expect(res.body).not.toContain('وصف المشروع');
  });

  it('keeps hostile project text from breaking out of HTML or JSON-LD', async () => {
    const res = await shell(`/projects/${evilId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('<script>alert');
    expect(res.body).not.toContain('<img src=x');
    for (const block of res.body.match(/<script data-seo="1" type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? []) {
      expect(block.slice(block.indexOf('>') + 1, -'</script>'.length)).not.toContain('<');
    }
    const [listing] = ldBlocks(res.body) as { name: string }[];
    expect(listing!.name).toBe(EVIL);
  });
});

describe('SEO shell: caching and failure', () => {
  it('supports ETag / 304', async () => {
    const first = await shell('/contact');
    const etag = first.headers.etag as string;
    expect(etag).toMatch(/^W\//);
    const second = await inject({
      method: 'GET',
      url: `/api/seo/shell?path=${encodeURIComponent('/contact')}`,
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });

  it('picks up a changed template and returns an empty 503 when it is missing', async () => {
    const file = path.join(distDir, 'index.html');
    expect((await shell('/careers')).body).toContain('<noscript>');
    fs.writeFileSync(file, TEMPLATE.replace('<body>', '<body><!--v2-->'));
    fs.utimesSync(file, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
    clearSeoCache();
    expect((await shell('/careers')).body).toContain('<!--v2-->');

    fs.rmSync(file);
    clearSeoCache();
    const gone = await shell('/careers');
    expect(gone.statusCode).toBe(503);
    expect(gone.body).toBe('');
    fs.writeFileSync(file, TEMPLATE);
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('allows crawling and points at the sitemap when indexing is on', async () => {
    const res = await inject({ method: 'GET', url: '/robots.txt' });
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('Allow: /');
    expect(res.body).toContain('Disallow: /admin');
    expect(res.body).toContain(`Sitemap: ${config.appUrl}/sitemap.xml`);
  });

  it('is fully noindex when indexing is off', async () => {
    config.seoIndexing = false;
    clearSeoCache();
    expect((await inject({ method: 'GET', url: '/robots.txt' })).body).toBe('User-agent: *\nDisallow: /\n');
    const home = await shell('/');
    expect(home.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(home.body).toContain('content="noindex, nofollow"');
    const map = await inject({ method: 'GET', url: '/sitemap.xml' });
    expect(map.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(map.body).not.toContain('<loc>');
  });

  it('lists published projects only, with lastmod and an image', async () => {
    const res = await inject({ method: 'GET', url: '/sitemap.xml' });
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.body).toContain(`<loc>${config.appUrl}/projects/saif-tower-${publishedId}</loc>`);
    expect(res.body).toContain(`<loc>${config.appUrl}/projects/${noPriceId}</loc>`);
    expect(res.body).toContain('<lastmod>');
    expect(res.body).toContain(`<image:loc>${config.appUrl}/uploads/seo/main.webp</image:loc>`);
    expect(res.body).not.toContain(`/projects/${draftId}<`);
    expect(res.body).toContain(`<loc>${config.appUrl}/</loc>`);
  });
});

describe('SEO shell: English bilingual routes (task-seo-e)', () => {
  it('renders /en with English title, html lang=en dir=ltr, self-canonical, hreflang trio, og:locale=en_US', async () => {
    const res = await shell('/en');
    expect(res.statusCode).toBe(200);
    const html = res.body;
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain(`<link data-seo="1" rel="canonical" href="${config.appUrl}/en" />`);
    expect(html).toContain(`<link data-seo="1" rel="alternate" hreflang="ar" href="${config.appUrl}/" />`);
    expect(html).toContain(`<link data-seo="1" rel="alternate" hreflang="en" href="${config.appUrl}/en" />`);
    expect(html).toContain(`<link data-seo="1" rel="alternate" hreflang="x-default" href="${config.appUrl}/" />`);
    expect(html).toContain('property="og:locale" content="en_US"');
    expect(html).toContain('property="og:locale:alternate" content="ar_SA"');
    expect(html).toContain('Ajda Real Estate');
    expect(html).toContain('<a href="/en/works">');
  });

  it('renders /en/works with English static copy', async () => {
    const res = await shell('/en/works');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(`<link data-seo="1" rel="canonical" href="${config.appUrl}/en/works" />`);
    expect(res.body).toContain('Our Projects | Ajda Real Estate');
  });

  it('renders /en/projects/{slug}-{id} with English fields and hreflang', async () => {
    const res = await shell(`/en/projects/saif-tower-${publishedId}`);
    expect(res.statusCode).toBe(200);
    const html = res.body;
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain(`<link data-seo="1" rel="canonical" href="${config.appUrl}/en/projects/saif-tower-${publishedId}" />`);
    expect(html).toContain(`<link data-seo="1" rel="alternate" hreflang="ar" href="${config.appUrl}/projects/saif-tower-${publishedId}" />`);
    expect(html).toContain(`<link data-seo="1" rel="alternate" hreflang="en" href="${config.appUrl}/en/projects/saif-tower-${publishedId}" />`);
    expect(html).toContain('Saif Tower — Riyadh | Ajda Real Estate');
  });

  it('answers 404 + noindex for /en/admin', async () => {
    const res = await shell('/en/admin');
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('includes both AR and EN in sitemap with xhtml:link', async () => {
    const res = await inject({ method: 'GET', url: '/sitemap.xml' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(res.body).toContain(`<loc>${config.appUrl}/</loc>`);
    expect(res.body).toContain(`<loc>${config.appUrl}/en</loc>`);
    expect(res.body).toContain('hreflang="ar"');
    expect(res.body).toContain('hreflang="en"');
  });
});

describe('seo helpers', () => {
  it('builds readable project slugs', () => {
    expect(slugify('Saif Tower')).toBe('saif-tower');
    expect(slugify('  Al-Nakheel  Complex!! (Phase 2) ')).toBe('al-nakheel-complex-phase-2');
    expect(slugify('برج السيف')).toBe('');
    expect(slugify(null)).toBe('');
    const long = slugify('word '.repeat(30));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
    expect(projectPath(5, 'Saif Tower')).toBe('/projects/saif-tower-5');
    expect(projectPath(5, 'برج')).toBe('/projects/5');
  });

  it('drops empty fields', () => {
    expect(compact({ a: '', b: null, c: undefined, d: [], e: 'x', f: 0 })).toEqual({ e: 'x', f: 0 });
  });

  it('escapes HTML and script-breaking characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    const json = jsonForScript({ t: `</script> & \u2028` });
    expect(json).not.toMatch(/[<>&\u2028]/);
    expect(JSON.parse(json).t).toBe(`</script> & \u2028`);
  });

  it('builds robots and an empty sitemap when indexing is off', () => {
    expect(buildRobotsTxt(false, 'https://x.test')).toBe('User-agent: *\nDisallow: /\n');
    expect(buildSitemapXml('https://x.test', [], { indexing: false, includeCareers: true })).not.toContain('<loc>');
    const on = buildSitemapXml('https://x.test', [], { indexing: true, includeCareers: false });
    expect(on).not.toContain('/careers');
  });
});
