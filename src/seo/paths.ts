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

export function pathForPage(page: SeoPage, projectId?: number, titleEn?: string | null): string {
  switch (page) {
    case 'home':
      return '/';
    case 'pastWorks':
      return '/past-works';
    case 'project':
      return projectPath(projectId ?? 206, titleEn);
    default:
      return `/${page}`;
  }
}
