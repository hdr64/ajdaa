/**
 * Admin sub-routes live under `/admin/*`. App.tsx keeps the part after `/admin/`
 * as `adminPath`, so refresh, deep links and back/forward all land on the same
 * section.
 *
 *   overview | projects | inquiries | categories | users
 *   projects/:id            project details   (alias: projects/:id/show)
 *   projects/:id/edit       project editor
 *   projects/:id/units      floors & units    (bare `units` picks the first project)
 */

export type AdminSection =
  | 'overview'
  | 'projects'
  | 'project'
  | 'projectEdit'
  | 'units'
  | 'inquiries'
  | 'categories'
  | 'users';

export interface AdminLocation {
  section: AdminSection;
  /** For `project`, `projectEdit` and `units`. */
  projectId?: number;
}

const SIMPLE_SECTIONS: AdminSection[] = ['overview', 'projects', 'units', 'inquiries', 'categories', 'users'];

const PROJECT_SUBROUTES: Record<string, AdminSection> = {
  '': 'project',
  show: 'project',
  edit: 'projectEdit',
  units: 'units',
};

export function parseAdminPath(adminPath: string | undefined): AdminLocation {
  const segments = (adminPath ?? '').split('/').filter(Boolean);
  const [first, second, third] = segments;

  if (first === 'projects' && second) {
    const projectId = Number(second);
    const section = PROJECT_SUBROUTES[third ?? ''];
    if (Number.isInteger(projectId) && projectId > 0 && section && segments.length <= 3) {
      return { section, projectId };
    }
    return { section: 'projects' };
  }

  if (first && (SIMPLE_SECTIONS as string[]).includes(first)) {
    return { section: first as AdminSection };
  }

  return { section: 'overview' };
}

export function buildAdminPath(location: AdminLocation): string {
  const { section, projectId } = location;
  if (projectId) {
    if (section === 'project') return `projects/${projectId}`;
    if (section === 'projectEdit') return `projects/${projectId}/edit`;
    if (section === 'units') return `projects/${projectId}/units`;
  }
  // Project pages without an id fall back to the list.
  if (section === 'project' || section === 'projectEdit') return 'projects';
  return section;
}

/** Which sidebar item is highlighted for a section. */
export function navSectionOf(section: AdminSection): AdminSection {
  return section === 'project' || section === 'projectEdit' ? 'projects' : section;
}
