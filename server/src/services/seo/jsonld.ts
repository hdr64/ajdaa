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
  featuresEn?: string | null;
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

export function homeJsonLd(origin: string, site: SiteContact, description: string, lang: 'ar' | 'en' = 'ar'): Json[] {
  const sameAs = Object.values(site.socials).filter((url) => /^https:\/\//.test(url));
  const isEn = lang === 'en';
  const org = compact({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${origin}/#org`,
    name: isEn ? BRAND_EN : BRAND_AR,
    alternateName: isEn ? BRAND_AR : BRAND_EN,
    url: `${origin}${isEn ? '/en' : '/'}`,
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
    url: `${origin}${isEn ? '/en' : '/'}`,
    name: isEn ? BRAND_EN : BRAND_AR,
    // Spelling variants people type (no hamza, Latin): helps Google match the brand query.
    alternateName: isEn ? [BRAND_AR, 'Ajda'] : [BRAND_EN, 'اجدا العقارية', 'Ajda'],
    inLanguage: lang,
    publisher: { '@id': `${origin}/#org` },
  };
  return [org, website];
}

export function projectJsonLd(origin: string, p: ProjectSeoData, description: string, lang: 'ar' | 'en' = 'ar'): Json[] {
  const images = [p.image, ...parseJsonArray(p.gallery).slice(0, 5)]
    .map((src) => absoluteUrl(origin, src))
    .filter((v): v is string => v !== null);
  const isEn = lang === 'en';
  const title = isEn ? (p.titleEn || p.title) : p.title;
  const city = isEn ? (p.cityEn || p.city) : p.city;
  const path = projectPath(p.id, p.titleEn, lang);
  const url = `${origin}${path}`;
  const hasGeo = p.lat !== null && p.lng !== null;
  const listing = compact({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description,
    url,
    image: images,
    datePosted: (p.publishedAt ?? p.createdAt).toISOString(),
    dateModified: p.updatedAt.toISOString(),
    inLanguage: lang,
    numberOfRooms: p.rooms && p.rooms > 0 ? p.rooms : undefined,
    numberOfBathroomsTotal: p.bathrooms && p.bathrooms > 0 ? p.bathrooms : undefined,
    floorSize: p.area > 0 ? { '@type': 'QuantitativeValue', value: p.area, unitCode: 'MTK' } : undefined,
    about: compact({
      '@type': 'Place',
      name: city,
      address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'SA' },
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
      { name: isEn ? 'Home' : 'الرئيسية', path: isEn ? '/en' : '/' },
      { name: isEn ? 'Our Projects' : 'مشاريعنا', path: isEn ? '/en/works' : '/works' },
      { name: title, path },
    ]),
  ];
}
