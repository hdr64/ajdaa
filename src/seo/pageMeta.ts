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

function projectJsonLd(origin: string, project: Property, lang: Lang, name: string, city: string, description: string) {
  const url = `${origin}${pathForPage('project', project.id, project.titleEn)}`;
  const images = [project.image, ...(project.gallery ?? []).slice(0, 5)]
    .map((src) => absolute(origin, src))
    .filter((v): v is string => v !== null);
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
        projectJsonLd(origin, project, lang, name, city, description),
        breadcrumbJsonLd(origin, [
          { name: isAr ? 'الرئيسية' : 'Home', path: isAr ? '/' : '/en' },
          { name: PAGES.works[lang].title, path: isAr ? '/works' : '/en/works' },
          { name, path: isAr ? arPath : enPath },
        ]),
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
