import { projectPath } from './slug';

/** Public URL of each routed page. Mirrors `getPathForRoute` in App.tsx (the site is served from `/`). */
export type SeoPage =
  | 'home'
  | 'works'
  | 'pastWorks'
  | 'clients'
  | 'project'
  | 'booking'
  | 'contact'
  | 'careers';

export function pathForPage(page: SeoPage, projectId?: number, titleEn?: string | null, lang: 'ar' | 'en' = 'ar'): string {
  let base: string;
  switch (page) {
    case 'home':
      base = '/';
      break;
    case 'pastWorks':
      base = '/past-works';
      break;
    case 'project':
      return projectPath(projectId ?? 206, titleEn, lang);
    default:
      base = `/${page}`;
      break;
  }
  if (lang === 'en') {
    return base === '/' ? '/en' : `/en${base}`;
  }
  return base;
}

/** Computes the counterpart URL in the target language (e.g. `/works` <-> `/en/works`). */
export function twinPath(pathname: string, targetLang: 'ar' | 'en'): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (targetLang === 'en') {
    if (clean === '/en' || clean.startsWith('/en/')) return clean;
    return clean === '/' ? '/en' : `/en${clean}`;
  }
  if (clean === '/en') return '/';
  if (clean.startsWith('/en/')) return clean.slice(3);
  return clean;
}
