import { BRAND_AR, BRAND_EN } from './pages.js';
import { absoluteUrl } from './escape.js';
import { projectPath } from './slug.js';

type Json = Record<string, unknown>;

export interface SiteContact {
  phone: string;
  email: string;
  addressAr: string;
  socials: Record<string, string>;
}

export interface ProjectSeoData {
  id: number;
  title: string;
  titleEn: string | null;
  city: string;
  cityEn: string | null;
  typeAr: string;
  priceType: string;
  price: number | null;
  priceLabel: string | null;
  area: number;
  rooms: number | null;
  bathrooms: number | null;
  description: string | null;
  descriptionEn: string | null;
  image: string;
  gallery: string | null;
  features: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
}

/** Drops empty strings, null and undefined so no field is emitted blank. */
export function compact<T extends Json>(obj: T): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
  } catch {
    return [];
  }
}

export function breadcrumbs(origin: string, trail: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

export function homeJsonLd(origin: string, site: SiteContact, description: string): Json[] {
  const sameAs = Object.values(site.socials).filter((url) => /^https:\/\//.test(url));
  const org = compact({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${origin}/#org`,
    name: BRAND_AR,
    alternateName: BRAND_EN,
    url: `${origin}/`,
    logo: `${origin}/logo.png`,
    image: `${origin}/logo.png`,
    description,
    telephone: site.phone,
    email: site.email,
    address: site.addressAr
      ? { '@type': 'PostalAddress', streetAddress: site.addressAr, addressCountry: 'SA' }
      : undefined,
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
    sameAs,
  });
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: `${origin}/`,
    name: BRAND_AR,
    // Spelling variants people type (no hamza, Latin): helps Google match the brand query.
    alternateName: [BRAND_EN, 'اجدا العقارية', 'Ajda'],
    inLanguage: 'ar',
    publisher: { '@id': `${origin}/#org` },
  };
  return [org, website];
}

export function projectJsonLd(origin: string, p: ProjectSeoData, description: string): Json[] {
  const images = [p.image, ...parseJsonArray(p.gallery).slice(0, 5)]
    .map((src) => absoluteUrl(origin, src))
    .filter((v): v is string => v !== null);
  const path = projectPath(p.id, p.titleEn);
  const url = `${origin}${path}`;
  const hasGeo = p.lat !== null && p.lng !== null;
  const listing = compact({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: p.title,
    description,
    url,
    image: images,
    datePosted: (p.publishedAt ?? p.createdAt).toISOString(),
    dateModified: p.updatedAt.toISOString(),
    inLanguage: 'ar',
    about: compact({
      '@type': 'Place',
      name: p.city,
      address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'SA' },
      geo: hasGeo ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
    }),
    offers:
      typeof p.price === 'number' && p.price > 0
        ? { '@type': 'Offer', price: p.price, priceCurrency: 'SAR', url }
        : undefined,
  });
  return [
    listing,
    breadcrumbs(origin, [
      { name: 'الرئيسية', path: '/' },
      { name: 'مشاريعنا', path: '/works' },
      { name: p.title, path },
    ]),
  ];
}
