import { escapeHtml, stripHtml, truncate, absoluteUrl } from './escape.js';
import {
  breadcrumbs,
  homeJsonLd,
  parseJsonArray,
  hasProject3d,
  projectJsonLd,
  projectsItemList,
  type ProjectSeoData,
  type SiteContact,
} from './jsonld.js';
import { BRAND_AR, BRAND_EN, STATIC_PAGES, type SeoRoute } from './pages.js';
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
  lang?: 'ar' | 'en';
  hreflang?: { ar: string; en: string; xDefault: string } | null;
}

export interface MetaContext {
  origin: string;
  indexing: boolean;
  site: SiteContact;
  /** Published projects for link lists (home, works). */
  projects: { id: number; title: string; titleEn: string | null; city: string; image?: string | null }[];
  /** Set only when the route is a project that exists and is published. */
  project?: ProjectSeoData | null;
}

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1';
export const ROBOTS_NOINDEX = 'noindex, nofollow';

const NAV_LINKS_AR: [string, string][] = [
  ['/', 'الرئيسية'],
  ['/works', 'مشاريعنا'],
  ['/clients', 'عملاؤنا'],
  ['/past-works', 'أعمالنا السابقة'],
  ['/careers', 'الوظائف'],
  ['/booking', 'سجل اهتمامك'],
  ['/contact', 'تواصل معنا'],
];

const NAV_LINKS_EN: [string, string][] = [
  ['/en', 'Home'],
  ['/en/works', 'Our Projects'],
  ['/en/clients', 'Our Clients and Partners'],
  ['/en/past-works', 'Past Projects'],
  ['/en/careers', 'Careers'],
  ['/en/booking', 'Register Interest'],
  ['/en/contact', 'Contact Us'],
];

function noscript(heading: string, description: string, extra = '', lang: 'ar' | 'en' = 'ar'): string {
  const links = lang === 'en' ? NAV_LINKS_EN : NAV_LINKS_AR;
  const nav = links.map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('');
  return `<noscript><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p><nav><ul>${nav}</ul></nav>${extra}</noscript>`;
}

function projectList(projects: MetaContext['projects'], lang: 'ar' | 'en' = 'ar'): string {
  if (projects.length === 0) return '';
  const isEn = lang === 'en';
  const heading = isEn ? 'Our Projects' : 'مشاريعنا';
  const items = projects
    .slice(0, 50)
    .map((p) => {
      const title = isEn ? (p.titleEn || p.title) : p.title;
      return `<li><a href="${projectPath(p.id, p.titleEn, lang)}">${escapeHtml(title)} — ${escapeHtml(p.city)}</a></li>`;
    })
    .join('');
  return `<h2>${escapeHtml(heading)}</h2><ul>${items}</ul>`;
}

function projectDescription(p: ProjectSeoData, lang: 'ar' | 'en' = 'ar'): string {
  if (lang === 'en') {
    const text = stripHtml(p.descriptionEn ?? '');
    if (text) return truncate(text, 155);
    const title = p.titleEn || p.title;
    const city = p.cityEn || p.city;
    return truncate(`${title} in ${city}, covering ${p.area} m².`, 155);
  }
  const text = stripHtml(p.description ?? '');
  if (text) return truncate(text, 155);
  return truncate(`${p.typeAr} لل${p.priceType} في ${p.city}، بمساحة ${p.area} م².`, 155);
}

function projectFacts(p: ProjectSeoData, lang: 'ar' | 'en' = 'ar'): string {
  if (lang === 'en') {
    const facts: string[] = [`City: ${p.cityEn || p.city}`, `Area: ${p.area} m²`];
    if (p.rooms) facts.push(`Rooms: ${p.rooms}`);
    if (p.bathrooms) facts.push(`Bathrooms: ${p.bathrooms}`);
    if (p.priceLabel) facts.push(`Price: ${p.priceLabel}`);
    if (hasProject3d(p)) facts.push('3D tour available');
    const features = parseJsonArray(p.featuresEn || p.features);
    const list = [...facts, ...features].map((f) => `<li>${escapeHtml(f)}</li>`).join('');
    return `<ul>${list}</ul>`;
  }
  const facts: string[] = [`المدينة: ${p.city}`, `المساحة: ${p.area} م²`];
  if (p.rooms) facts.push(`الغرف: ${p.rooms}`);
  if (p.bathrooms) facts.push(`دورات المياه: ${p.bathrooms}`);
  if (p.priceLabel) facts.push(`السعر: ${p.priceLabel}`);
  if (hasProject3d(p)) facts.push('جولة ثلاثية الأبعاد متاحة');
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
      lang: 'ar',
      hreflang: null,
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
      lang: 'ar',
      hreflang: null,
    };
  }

  if (route.kind === 'project') {
    const p = ctx.project!;
    const isEn = route.lang === 'en';
    const brand = isEn ? BRAND_EN : BRAND_AR;
    const titleText = isEn ? (p.titleEn || p.title) : p.title;
    const cityText = isEn ? (p.cityEn || p.city) : p.city;
    const description = projectDescription(p, route.lang);
    const title = `${titleText} — ${cityText} | ${brand}`;
    const arPath = projectPath(p.id, p.titleEn, 'ar');
    const enPath = projectPath(p.id, p.titleEn, 'en');
    const canonical = `${origin}${isEn ? enPath : arPath}`;
    const hreflang = {
      ar: `${origin}${arPath}`,
      en: `${origin}${enPath}`,
      xDefault: `${origin}${arPath}`,
    };

    return {
      status: 200,
      title,
      description,
      canonical,
      robots,
      social: true,
      image: absoluteUrl(origin, p.image) ?? defaultImage,
      imageAlt: `${titleText} — ${cityText}`,
      jsonLd: projectJsonLd(origin, p, description, route.lang),
      noscriptHtml: noscript(titleText, description, projectFacts(p, route.lang), route.lang),
      lang: route.lang,
      hreflang,
    };
  }

  const page = STATIC_PAGES[route.key];
  const isEn = route.lang === 'en';
  const brand = isEn ? BRAND_EN : BRAND_AR;
  const isHome = route.key === 'home';
  const title = isEn
    ? (isHome ? page.titleEn : `${page.titleEn} | ${brand}`)
    : (isHome ? page.titleAr : `${page.titleAr} | ${brand}`);
  const description = isEn ? page.descEn : page.descAr;
  const arPath = page.path;
  const enPath = page.path === '/' ? '/en' : `/en${page.path}`;
  const canonical = `${origin}${route.canonicalPath === '/' ? '/' : route.canonicalPath}`;
  const hreflang = {
    ar: `${origin}${arPath}`,
    en: `${origin}${enPath}`,
    xDefault: `${origin}${arPath}`,
  };

  const itemList = route.key === 'works' ? projectsItemList(origin, ctx.projects, route.lang) : null;
  const jsonLd = isHome
    ? homeJsonLd(origin, ctx.site, description, route.lang)
    : [
        breadcrumbs(origin, [
          { name: isEn ? 'Home' : 'الرئيسية', path: isEn ? '/en' : '/' },
          { name: isEn ? page.titleEn : page.titleAr, path: route.canonicalPath },
        ]),
        ...(itemList ? [itemList] : []),
      ];
  const withProjects = route.key === 'home' || route.key === 'works';
  const heading = isHome ? brand : (isEn ? page.titleEn : page.titleAr);
  return {
    status: 200,
    title,
    description,
    canonical,
    robots,
    social: true,
    image: defaultImage,
    imageAlt: brand,
    jsonLd,
    noscriptHtml: noscript(heading, description, withProjects ? projectList(ctx.projects, route.lang) : '', route.lang),
    lang: route.lang,
    hreflang,
  };
}
