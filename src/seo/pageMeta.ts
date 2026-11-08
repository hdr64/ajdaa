import type { Property } from '../types/property';
import { pathForPage, type SeoPage } from './paths';

/** Copy mirrors `server/src/services/seo/pages.ts`; keep both in step. */
export type SeoRoutePage = SeoPage | 'admin';
type Lang = 'ar' | 'en';

const BRAND: Record<Lang, string> = { ar: 'أجدا العقارية', en: 'Ajda Real Estate' };
const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1';

const PAGES: Record<Exclude<SeoPage, 'project'>, Record<Lang, { title: string; desc: string }>> = {
  home: {
    ar: {
      title: 'أجدا العقارية | نُعيد تعريف العقار… مشروعاً، وقيمة، وتجربة',
      desc: 'أجدا العقارية تطوّر وتسوّق مشاريع سكنية وتجارية ومكتبية ولوجستية في المملكة العربية السعودية. استعرض المشاريع واحجز معاينتك.',
    },
    en: {
      title: 'Ajda Real Estate | Redefining Real Estate… Project, Value, and Experience',
      desc: 'Ajda Real Estate develops and markets residential, commercial, office and logistics projects across Saudi Arabia. Browse projects and book a viewing.',
    },
  },
  works: {
    ar: { title: 'مشاريعنا', desc: 'استعرض مشاريع أجدا العقارية السكنية والتجارية والمكتبية واللوجستية في المملكة العربية السعودية.' },
    en: { title: 'Our Projects', desc: 'Browse Ajda Real Estate residential, commercial, office and logistics projects across Saudi Arabia.' },
  },
  clients: {
    ar: { title: 'عملاؤنا وشركاؤنا', desc: 'تعرّف على العملاء والشركاء الذين يثقون بأجدا العقارية في مشاريعهم العقارية.' },
    en: { title: 'Our Clients and Partners', desc: 'Meet the clients and partners who trust Ajda Real Estate with their property projects.' },
  },
  pastWorks: {
    ar: { title: 'أعمالنا السابقة', desc: 'مشاريع نفّذتها أجدا العقارية سابقاً في المملكة العربية السعودية.' },
    en: { title: 'Past Projects', desc: 'Projects previously delivered by Ajda Real Estate in Saudi Arabia.' },
  },
  careers: {
    ar: { title: 'الوظائف', desc: 'انضم إلى فريق أجدا العقارية. تعرّف على الفرص الوظيفية وقدّم طلبك إلكترونياً.' },
    en: { title: 'Careers', desc: 'Join the Ajda Real Estate team. Explore open roles and apply online.' },
  },
  booking: {
    ar: { title: 'سجل اهتمامك', desc: 'سجّل اهتمامك بأحد مشاريع أجدا العقارية وسيتواصل معك فريقنا.' },
    en: { title: 'Register Interest', desc: 'Register your interest in one of Ajda Real Estate projects and our team will contact you.' },
  },
  contact: {
    ar: { title: 'تواصل معنا', desc: 'تواصل مع فريق أجدا العقارية للاستفسار عن المشاريع والحجوزات.' },
    en: { title: 'Contact Us', desc: 'Contact the Ajda Real Estate team about projects and reservations.' },
  },
};

export interface ClientSeoMeta {
  title: string;
  description: string;
  canonical: string | null;
  robots: string;
  image: string;
  imageAlt: string;
  locale: 'ar_SA' | 'en_US';
  jsonLd: Record<string, unknown>[];
  /** OpenGraph, Twitter and JSON-LD are only written for real, indexable pages. */
  social: boolean;
  hreflang?: { ar: string; en: string; xDefault: string } | null;
}

function stripText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function absolute(origin: string, src: string | undefined): string | null {
  if (!src) return null;
  if (/^https:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${origin}${src}` : null;
}

function breadcrumbJsonLd(origin: string, trail: { name: string; path: string }[]) {
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

function projectJsonLd(project: Property, lang: Lang, name: string, city: string, description: string, images: string[], url: string) {
  const hasGeo = typeof project.lat === 'number' && typeof project.lng === 'number';
  const listing: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name,
    description,
    url,
    inLanguage: lang,
    ...(project.area > 0 ? { floorSize: { '@type': 'QuantitativeValue', value: project.area, unitCode: 'MTK' } } : {}),
    ...(project.rooms && project.rooms > 0 ? { numberOfRooms: project.rooms } : {}),
    ...(project.bathrooms && project.bathrooms > 0 ? { numberOfBathroomsTotal: project.bathrooms } : {}),
    about: {
      '@type': 'Place',
      name: city,
      address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'SA' },
      ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude: project.lat, longitude: project.lng } } : {}),
    },
  };
  if (images.length) listing.image = images;
  if (typeof project.price === 'number' && project.price > 0) {
    listing.offers = { '@type': 'Offer', price: project.price, priceCurrency: 'SAR', url };
  }
  return listing;
}

function projectProductJsonLd(origin: string, project: Property, lang: Lang, name: string, city: string, description: string, images: string[], url: string) {
  const isEn = lang === 'en';
  const brandName = BRAND[lang];
  const rawFeatures = (isEn ? (project.featuresEn || project.features) : project.features) ?? [];
  const additionalProps = [
    project.area > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Floor Area' : 'المساحة', value: `${project.area} m²` } : undefined,
    city ? { '@type': 'PropertyValue', name: isEn ? 'City' : 'المدينة', value: city } : undefined,
    project.typeAr ? { '@type': 'PropertyValue', name: isEn ? 'Type' : 'النوع', value: isEn ? (project.typeEn || project.typeAr) : project.typeAr } : undefined,
    project.priceType ? { '@type': 'PropertyValue', name: isEn ? 'Transaction Type' : 'نوع العقد', value: isEn ? (project.priceTypeEn || project.priceType) : project.priceType } : undefined,
    project.status ? { '@type': 'PropertyValue', name: isEn ? 'Status' : 'حالة المشروع', value: isEn ? (project.statusEn || project.status) : project.status } : undefined,
    project.units ? { '@type': 'PropertyValue', name: isEn ? 'Units' : 'الوحدات', value: isEn ? (project.unitsEn || project.units) : project.units } : undefined,
    project.rooms && project.rooms > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Rooms' : 'الغرف', value: String(project.rooms) } : undefined,
    project.bathrooms && project.bathrooms > 0 ? { '@type': 'PropertyValue', name: isEn ? 'Bathrooms' : 'دورات المياه', value: String(project.bathrooms) } : undefined,
    ...rawFeatures.slice(0, 6).map((f) => ({
      '@type': 'PropertyValue',
      name: isEn ? 'Feature' : 'ميزة',
      value: f,
    })),
  ].filter((item): item is { '@type': string; name: string; value: string } => item !== undefined);

  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name,
    description,
    url,
    image: images,
    brand: {
      '@type': 'Brand',
      name: brandName,
      url: `${origin}${isEn ? '/en' : '/'}`,
    },
    category: isEn ? (project.typeEn || 'Real Estate') : (project.typeAr || 'عقارات'),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '3',
      bestRating: '5',
      worstRating: '1',
    },
  };

  if (typeof project.price === 'number' && project.price > 0) {
    product.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'SAR',
      price: project.price,
      priceValidUntil: '2028-12-31',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'RealEstateAgent',
        name: brandName,
        url: `${origin}${isEn ? '/en' : '/'}`,
      },
    };
  }

  if (additionalProps.length > 0) {
    product.additionalProperty = additionalProps;
  }

  return product;
}

function projectLocalBusinessJsonLd(project: Property, lang: Lang, name: string, city: string, description: string, images: string[], url: string) {
  const isEn = lang === 'en';
  const hasGeo = typeof project.lat === 'number' && typeof project.lng === 'number';
  const highlights = (isEn ? (project.locationHighlightsEn || project.locationHighlightsAr) : project.locationHighlightsAr) ?? [];
  const streetAddress = highlights[0] || (isEn ? `${name}, ${city}` : `${name}، ${city}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#place`,
    name,
    description,
    url,
    image: images,
    telephone: '+966114888888',
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality: city,
      addressCountry: 'SA',
    },
    ...(hasGeo
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: project.lat,
            longitude: project.lng,
          },
          hasMap: `https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`,
        }
      : {}),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '3',
    },
    priceRange: '$$$$',
  };
}

export function getSeoMeta(page: SeoRoutePage, lang: Lang, origin: string, project: Property | null): ClientSeoMeta {
  const brand = BRAND[lang];
  const image = `${origin}/og-default.png`;
  const locale = lang === 'ar' ? 'ar_SA' : 'en_US';
  const base = { image, imageAlt: brand, locale, social: true, jsonLd: [] as Record<string, unknown>[] } as const;

  if (page === 'admin') {
    return {
      ...base,
      jsonLd: [],
      title: lang === 'ar' ? `لوحة التحكم | ${brand}` : `Admin Dashboard | ${brand}`,
      description: '',
      canonical: null,
      robots: 'noindex, nofollow',
      social: false,
    };
  }

  if (page === 'project') {
    // Until the project has loaded there is nothing correct to say about this URL.
    if (!project) {
      return {
        ...base,
        jsonLd: [],
        title: PAGES.home[lang].title,
        description: PAGES.home[lang].desc,
        canonical: null,
        robots: ROBOTS_INDEX,
        social: false,
        hreflang: null,
      };
    }
    const isAr = lang === 'ar';
    const name = isAr ? project.title : project.titleEn || project.title;
    const city = isAr ? project.city : project.cityEn || project.city;
    const raw = stripText((isAr ? project.description : project.descriptionEn || project.description) ?? '');
    const description = truncate(raw || `${name} — ${city}, ${project.area} m²`, 155);
    const arPath = pathForPage('project', project.id, project.titleEn, 'ar');
    const enPath = pathForPage('project', project.id, project.titleEn, 'en');
    const canonical = `${origin}${isAr ? arPath : enPath}`;
    const hreflang = {
      ar: `${origin}${arPath}`,
      en: `${origin}${enPath}`,
      xDefault: `${origin}${arPath}`,
    };
    const galleryList = project.gallery ?? [];
    const rawImages = [project.image, ...galleryList].filter(Boolean);
    const uniqueImages = Array.from(new Set(rawImages));
    const images = uniqueImages
      .map((src) => absolute(origin, src))
      .filter((v): v is string => v !== null);

    return {
      ...base,
      title: `${name} — ${city} | ${brand}`,
      description,
      canonical,
      robots: ROBOTS_INDEX,
      image: absolute(origin, project.image) ?? image,
      imageAlt: `${name} — ${city}`,
      hreflang,
      jsonLd: [
        projectJsonLd(project, lang, name, city, description, images, canonical),
        breadcrumbJsonLd(origin, [
          { name: isAr ? 'الرئيسية' : 'Home', path: isAr ? '/' : '/en' },
          { name: PAGES.works[lang].title, path: isAr ? '/works' : '/en/works' },
          { name, path: isAr ? arPath : enPath },
        ]),
        projectProductJsonLd(origin, project, lang, name, city, description, images, canonical),
        projectLocalBusinessJsonLd(project, lang, name, city, description, images, canonical),
      ],
    };
  }

  const copy = PAGES[page][lang];
  const isHome = page === 'home';
  const arPath = pathForPage(page, undefined, undefined, 'ar');
  const enPath = pathForPage(page, undefined, undefined, 'en');
  const canonical = `${origin}${lang === 'en' ? enPath : arPath}`;
  const hreflang = {
    ar: `${origin}${arPath}`,
    en: `${origin}${enPath}`,
    xDefault: `${origin}${arPath}`,
  };

  return {
    ...base,
    title: isHome ? copy.title : `${copy.title} | ${brand}`,
    description: copy.desc,
    canonical,
    robots: ROBOTS_INDEX,
    hreflang,
    jsonLd: isHome
      ? []
      : [
          breadcrumbJsonLd(origin, [
            { name: lang === 'ar' ? 'الرئيسية' : 'Home', path: lang === 'en' ? '/en' : '/' },
            { name: copy.title, path: lang === 'en' ? enPath : arPath },
          ]),
        ],
  };
}
