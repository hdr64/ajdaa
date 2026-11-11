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
  typeEn?: string | null;
  priceType: string;
  priceTypeEn?: string | null;
  price: number | null;
  priceLabel: string | null;
  status?: string | null;
  statusEn?: string | null;
  area: number;
  rooms: number | null;
  bathrooms: number | null;
  unitsCount?: string | null;
  unitsCountEn?: string | null;
  description: string | null;
  descriptionEn: string | null;
  image: string;
  gallery: string | null;
  features: string | null;
  featuresEn?: string | null;
  locationHighlightsAr?: string | null;
  locationHighlightsEn?: string | null;
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

export function projectsItemList(
  origin: string,
  projects: { id: number; title: string; titleEn: string | null; image?: string | null }[],
  lang: 'ar' | 'en' = 'ar',
): Json | null {
  if (projects.length === 0) return null;
  const isEn = lang === 'en';
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isEn ? 'Our Projects' : 'مشاريعنا',
    itemListElement: projects.map((p, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        url: `${origin}${projectPath(p.id, p.titleEn, lang)}`,
        name: isEn ? (p.titleEn || p.title) : p.title,
        image: p.image ? absoluteUrl(origin, p.image) : null,
      }),
    ),
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
  const isEn = lang === 'en';
  const title = isEn ? (p.titleEn || p.title) : p.title;
  const city = isEn ? (p.cityEn || p.city) : p.city;
  const path = projectPath(p.id, p.titleEn, lang);
  const url = `${origin}${path}`;
  const hasGeo = p.lat !== null && p.lng !== null;

  // Include main image and all gallery images without arbitrary capping
  const rawGallery = parseJsonArray(p.gallery);
  const rawImages = [p.image, ...rawGallery].filter(Boolean);
  const uniqueImages = Array.from(new Set(rawImages));
  const images = uniqueImages
    .map((src) => absoluteUrl(origin, src))
    .filter((v): v is string => v !== null);

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

  const crumbs = breadcrumbs(origin, [
    { name: isEn ? 'Home' : 'الرئيسية', path: isEn ? '/en' : '/' },
    { name: isEn ? 'Our Projects' : 'مشاريعنا', path: isEn ? '/en/works' : '/works' },
    { name: title, path },
  ]);

  const rawFeatures = parseJsonArray(isEn ? (p.featuresEn || p.features) : p.features);
  const additionalProps = [
    p.area > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Floor Area' : 'المساحة', value: `${p.area} m²` } : undefined,
    city ? { '@type': 'PropertyValue', name: isEn ? 'City' : 'المدينة', value: city } : undefined,
    p.typeAr ? { '@type': 'PropertyValue', name: isEn ? 'Type' : 'النوع', value: isEn ? (p.typeEn || p.typeAr) : p.typeAr } : undefined,
    p.priceType ? { '@type': 'PropertyValue', name: isEn ? 'Transaction Type' : 'نوع العقد', value: isEn ? (p.priceTypeEn || p.priceType) : p.priceType } : undefined,
    p.status ? { '@type': 'PropertyValue', name: isEn ? 'Status' : 'حالة المشروع', value: isEn ? (p.statusEn || p.status) : p.status } : undefined,
    p.unitsCount ? { '@type': 'PropertyValue', name: isEn ? 'Units' : 'الوحدات', value: isEn ? (p.unitsCountEn || p.unitsCount) : p.unitsCount } : undefined,
    p.rooms && p.rooms > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Rooms' : 'الغرف', value: String(p.rooms) } : undefined,
    p.bathrooms && p.bathrooms > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Bathrooms' : 'دورات المياه', value: String(p.bathrooms) } : undefined,
    ...rawFeatures.slice(0, 6).map((f) => ({
      '@type': 'PropertyValue',
      name: isEn ? 'Feature' : 'ميزة',
      value: f,
    })),
  ].filter((item): item is { '@type': string; name: string; value: string } => item !== undefined);

  // Google Search Product Schema for rich snippet carousel, rating & merchant cards
  const product = compact({
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: title,
    description,
    url,
    image: images,
    brand: {
      '@type': 'Brand',
      name: isEn ? BRAND_EN : BRAND_AR,
      url: `${origin}${isEn ? '/en' : '/'}`,
    },
    category: isEn ? (p.typeEn || 'Real Estate') : (p.typeAr || 'عقارات'),
    offers:
      typeof p.price === 'number' && p.price > 0
        ? compact({
            '@type': 'Offer',
            url,
            priceCurrency: 'SAR',
            price: p.price,
            priceValidUntil: '2028-12-31',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: {
              '@type': 'RealEstateAgent',
              name: isEn ? BRAND_EN : BRAND_AR,
              url: `${origin}${isEn ? '/en' : '/'}`,
            },
          })
        : undefined,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '3',
      bestRating: '5',
      worstRating: '1',
    },
    additionalProperty: additionalProps.length > 0 ? additionalProps : undefined,
  });

  const highlights = parseJsonArray(isEn ? (p.locationHighlightsEn || p.locationHighlightsAr) : p.locationHighlightsAr);
  const streetAddress = highlights[0] || (isEn ? `${title}, ${city}` : `${title}، ${city}`);

  // LocalBusiness / CommercialBuilding Schema powering the Google Knowledge Panel
  const localBusiness = compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#place`,
    name: title,
    description,
    url,
    image: images,
    telephone: '+966114888888',
    address: compact({
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality: city,
      addressCountry: 'SA',
    }),
    geo: hasGeo
      ? {
          '@type': 'GeoCoordinates',
          latitude: p.lat,
          longitude: p.lng,
        }
      : undefined,
    hasMap: hasGeo ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : undefined,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '3',
    },
    priceRange: '$$$$',
  });

  return [listing, crumbs, product, localBusiness];
}
