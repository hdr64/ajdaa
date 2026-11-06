/**
 * Public SPA routes and their copy. Mirrors `parsePath` in `src/App.tsx` and the
 * client copy in `src/seo/pageMeta.ts`; keep the three in step.
 */

export type PageKey = 'home' | 'works' | 'clients' | 'pastWorks' | 'careers' | 'booking' | 'contact';

export type SeoRoute =
  | { kind: 'page'; key: PageKey; canonicalPath: string; lang: 'ar' | 'en' }
  | { kind: 'project'; id: number; canonicalPath: string; lang: 'ar' | 'en' }
  | { kind: 'admin' }
  | { kind: 'notFound' };

export const BRAND_AR = 'أجدا العقارية';
export const BRAND_EN = 'Ajda Real Estate';

export const STATIC_PAGES: Record<
  PageKey,
  { path: string; titleAr: string; titleEn: string; descAr: string; descEn: string }
> = {
  home: {
    path: '/',
    titleAr: 'أجدا العقارية | نُعيد تعريف العقار… مشروعاً، وقيمة، وتجربة',
    titleEn: 'Ajda Real Estate | Redefining Real Estate… Project, Value, and Experience',
    descAr: 'أجدا العقارية تطوّر وتسوّق مشاريع سكنية وتجارية ومكتبية ولوجستية في المملكة العربية السعودية. استعرض المشاريع واحجز معاينتك.',
    descEn: 'Ajda Real Estate develops and markets residential, commercial, office and logistics projects across Saudi Arabia. Browse projects and book a viewing.',
  },
  works: {
    path: '/works',
    titleAr: 'مشاريعنا',
    titleEn: 'Our Projects',
    descAr: 'استعرض مشاريع أجدا العقارية السكنية والتجارية والمكتبية واللوجستية في المملكة العربية السعودية.',
    descEn: 'Browse Ajda Real Estate residential, commercial, office and logistics projects across Saudi Arabia.',
  },
  clients: {
    path: '/clients',
    titleAr: 'عملاؤنا وشركاؤنا',
    titleEn: 'Our Clients and Partners',
    descAr: 'تعرّف على العملاء والشركاء الذين يثقون بأجدا العقارية في مشاريعهم العقارية.',
    descEn: 'Meet the clients and partners who trust Ajda Real Estate with their property projects.',
  },
  pastWorks: {
    path: '/past-works',
    titleAr: 'أعمالنا السابقة',
    titleEn: 'Past Projects',
    descAr: 'مشاريع نفّذتها أجدا العقارية سابقاً في المملكة العربية السعودية.',
    descEn: 'Projects previously delivered by Ajda Real Estate in Saudi Arabia.',
  },
  careers: {
    path: '/careers',
    titleAr: 'الوظائف',
    titleEn: 'Careers',
    descAr: 'انضم إلى فريق أجدا العقارية. تعرّف على الفرص الوظيفية وقدّم طلبك إلكترونياً.',
    descEn: 'Join the Ajda Real Estate team. Explore open roles and apply online.',
  },
  booking: {
    path: '/booking',
    titleAr: 'سجل اهتمامك',
    titleEn: 'Register Interest',
    descAr: 'سجّل اهتمامك بأحد مشاريع أجدا العقارية وسيتواصل معك فريقنا.',
    descEn: 'Register your interest in one of Ajda Real Estate projects and our team will contact you.',
  },
  contact: {
    path: '/contact',
    titleAr: 'تواصل معنا',
    titleEn: 'Contact Us',
    descAr: 'تواصل مع فريق أجدا العقارية للاستفسار عن المشاريع والحجوزات.',
    descEn: 'Contact the Ajda Real Estate team about projects and reservations.',
  },
};

const PAGE_BY_PATH: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/clients': 'clients',
  '/past-works': 'pastWorks',
  '/careers': 'careers',
  '/booking': 'booking',
  '/register-interest': 'booking',
  '/contact': 'contact',
};

/** Lower-cases, drops query/hash and a trailing slash. Invalid input becomes "/__invalid__". */
export function normalizePath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 300 || !raw.startsWith('/')) {
    return '/__invalid__';
  }
  const clean = raw.split('#')[0]!.split('?')[0]!.toLowerCase();
  const trimmed = clean.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function matchRoute(raw: unknown): SeoRoute {
  const path = normalizePath(raw);
  if (path === '/admin' || path.startsWith('/admin/')) return { kind: 'admin' };
  if (path === '/en/admin' || path.startsWith('/en/admin/')) return { kind: 'notFound' };

  const isEn = path === '/en' || path.startsWith('/en/');
  const lang: 'ar' | 'en' = isEn ? 'en' : 'ar';
  const subPath = isEn ? (path === '/en' ? '/' : path.slice(3)) : path;

  const key = PAGE_BY_PATH[subPath];
  if (key) {
    const canonicalPath = isEn
      ? (STATIC_PAGES[key].path === '/' ? '/en' : `/en${STATIC_PAGES[key].path}`)
      : STATIC_PAGES[key].path;
    return { kind: 'page', key, canonicalPath, lang };
  }

  // `/projects/206`, `/project/206` and `/projects/villa-riyadh-206`: only the id selects the project.
  const project = subPath.match(/^\/projects?\/(?:[a-z0-9-]*-)?(\d{1,9})$/);
  if (project) {
    const id = Number(project[1]);
    const canonicalPath = isEn ? `/en/projects/${id}` : `/projects/${id}`;
    return { kind: 'project', id, canonicalPath, lang };
  }
  return { kind: 'notFound' };
}
