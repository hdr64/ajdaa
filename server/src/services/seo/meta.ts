import { escapeHtml, stripHtml, truncate, absoluteUrl } from './escape.js';
import {
  breadcrumbs,
  homeJsonLd,
  parseJsonArray,
  projectJsonLd,
  type ProjectSeoData,
  type SiteContact,
} from './jsonld.js';
import { BRAND_AR, STATIC_PAGES, type SeoRoute } from './pages.js';
import { projectPath } from './slug.js';

export interface PageMeta {
  status: 200 | 404;
  title: string;
  description: string;
  canonical: string | null;
  robots: string;
  /** OpenGraph, Twitter and JSON-LD are only emitted for real pages. */
  social: boolean;
  image: string;
  imageAlt: string;
  jsonLd: Record<string, unknown>[];
  noscriptHtml: string;
}

export interface MetaContext {
  origin: string;
  indexing: boolean;
  site: SiteContact;
  /** Published projects for link lists (home, works). */
  projects: { id: number; title: string; titleEn: string | null; city: string }[];
  /** Set only when the route is a project that exists and is published. */
  project?: ProjectSeoData | null;
}

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1';
export const ROBOTS_NOINDEX = 'noindex, nofollow';

const NAV_LINKS: [string, string][] = [
  ['/', 'الرئيسية'],
  ['/works', 'مشاريعنا'],
  ['/clients', 'عملاؤنا'],
  ['/past-works', 'أعمالنا السابقة'],
  ['/careers', 'الوظائف'],
  ['/booking', 'سجل اهتمامك'],
  ['/contact', 'تواصل معنا'],
];

function noscript(heading: string, description: string, extra = ''): string {
  const nav = NAV_LINKS.map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('');
  return `<noscript><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p><nav><ul>${nav}</ul></nav>${extra}</noscript>`;
}

function projectList(projects: MetaContext['projects']): string {
  if (projects.length === 0) return '';
  const items = projects
    .slice(0, 50)
    .map((p) => `<li><a href="${projectPath(p.id, p.titleEn)}">${escapeHtml(p.title)} — ${escapeHtml(p.city)}</a></li>`)
    .join('');
  return `<h2>مشاريعنا</h2><ul>${items}</ul>`;
}

function projectDescription(p: ProjectSeoData): string {
  const text = stripHtml(p.description ?? '');
  if (text) return truncate(text, 155);
  return truncate(`${p.typeAr} لل${p.priceType} في ${p.city}، بمساحة ${p.area} م².`, 155);
}

function projectFacts(p: ProjectSeoData): string {
  const facts: string[] = [`المدينة: ${p.city}`, `المساحة: ${p.area} م²`];
  if (p.rooms) facts.push(`الغرف: ${p.rooms}`);
  if (p.bathrooms) facts.push(`دورات المياه: ${p.bathrooms}`);
  if (p.priceLabel) facts.push(`السعر: ${p.priceLabel}`);
  const features = parseJsonArray(p.features);
  const list = [...facts, ...features].map((f) => `<li>${escapeHtml(f)}</li>`).join('');
  return `<ul>${list}</ul>`;
}

export function buildMeta(route: SeoRoute, ctx: MetaContext): PageMeta {
  const { origin, indexing } = ctx;
  const robots = indexing ? ROBOTS_INDEX : ROBOTS_NOINDEX;
  const defaultImage = `${origin}/og-default.png`;

  if (route.kind === 'admin') {
    return {
      status: 200,
      title: `لوحة التحكم | ${BRAND_AR}`,
      description: '',
      canonical: null,
      robots: ROBOTS_NOINDEX,
      social: false,
      image: defaultImage,
      imageAlt: BRAND_AR,
      jsonLd: [],
      noscriptHtml: '',
    };
  }

  if (route.kind === 'notFound' || (route.kind === 'project' && !ctx.project)) {
    return {
      status: 404,
      title: `الصفحة غير موجودة | ${BRAND_AR}`,
      description: '',
      canonical: null,
      robots: ROBOTS_NOINDEX,
      social: false,
      image: defaultImage,
      imageAlt: BRAND_AR,
      jsonLd: [],
      noscriptHtml: noscript('الصفحة غير موجودة', 'الصفحة التي تبحث عنها غير متاحة.'),
    };
  }

  if (route.kind === 'project') {
    const p = ctx.project!;
    const description = projectDescription(p);
    const title = `${p.title} — ${p.city} | ${BRAND_AR}`;
    return {
      status: 200,
      title,
      description,
      canonical: `${origin}${projectPath(p.id, p.titleEn)}`,
      robots,
      social: true,
      image: absoluteUrl(origin, p.image) ?? defaultImage,
      imageAlt: `${p.title} — ${p.city}`,
      jsonLd: projectJsonLd(origin, p, description),
      noscriptHtml: noscript(p.title, description, projectFacts(p)),
    };
  }

  const page = STATIC_PAGES[route.key];
  const isHome = route.key === 'home';
  const title = isHome ? page.titleAr : `${page.titleAr} | ${BRAND_AR}`;
  const jsonLd = isHome
    ? homeJsonLd(origin, ctx.site, page.descAr)
    : [
        breadcrumbs(origin, [
          { name: 'الرئيسية', path: '/' },
          { name: page.titleAr, path: page.path },
        ]),
      ];
  const withProjects = route.key === 'home' || route.key === 'works';
  return {
    status: 200,
    title,
    description: page.descAr,
    canonical: `${origin}${route.canonicalPath === '/' ? '/' : route.canonicalPath}`,
    robots,
    social: true,
    image: defaultImage,
    imageAlt: BRAND_AR,
    jsonLd,
    noscriptHtml: noscript(isHome ? BRAND_AR : page.titleAr, page.descAr, withProjects ? projectList(ctx.projects) : ''),
  };
}
