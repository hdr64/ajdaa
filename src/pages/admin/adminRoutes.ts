/**
 * Admin sub-routes live under `/admin/*`. App.tsx keeps the part after `/admin/`
 * as `adminPath`, so refresh, deep links and back/forward all land on the same
 * section.
 */

export type AdminSection = 'overview' | 'projects' | 'units' | 'inquiries' | 'categories' | 'users';

export interface AdminLocation {
  section: AdminSection;
  /** Only for `units`: the project whose floors are shown. */
  projectId?: number;
}

const SIMPLE_SECTIONS: AdminSection[] = ['overview', 'projects', 'units', 'inquiries', 'categories', 'users'];

export function parseAdminPath(adminPath: string | undefined): AdminLocation {
  const segments = (adminPath ?? '').split('/').filter(Boolean);
  const [first, second, third] = segments;

  // projects/:id/units
  if (first === 'projects' && second && third === 'units') {
    const projectId = Number(second);
    if (Number.isInteger(projectId) && projectId > 0) return { section: 'units', projectId };
  }

  if (first && (SIMPLE_SECTIONS as string[]).includes(first)) {
    return { section: first as AdminSection };
  }

  return { section: 'overview' };
}

export function buildAdminPath(location: AdminLocation): string {
  if (location.section === 'units' && location.projectId) {
    return `projects/${location.projectId}/units`;
  }
  return location.section;
}
