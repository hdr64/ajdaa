/**
 * Admin sub-routes live under `/admin/*`. App.tsx keeps the part after `/admin/`
 * as `adminPath`, so refresh, deep links and back/forward all land on the same
 * section. The path is matched case-insensitively (`/admin/pastProjects` is the
 * same section as `/admin/pastprojects`).
 *
 *   overview | projects | inquiries | categories | users | profile
 *   newsletter              newsletter subscribers
 *   settings                mail (SMTP) settings, super admin only
 *   roles | departments    HR reference data behind the user accounts
 *   projects/:id            project details   (alias: projects/:id/show)
 *   projects/:id/edit       project editor
 *   projects/:id/units      floors & units    (bare `units` picks the first project)
 *   inquiries/:id           single inquiry detail
 */

export type AdminSection =
  | 'overview'
  | 'projects'
  | 'project'
  | 'projectEdit'
  | 'units'
  | 'inquiries'
  | 'inquiry'
  | 'applications'
  | 'categories'
  | 'pastProjects'
  | 'cms'
  | 'users'
  | 'roles'
  | 'departments'
  | 'profile'
  | 'newsletter'
  | 'settings';

export interface AdminLocation {
  section: AdminSection;
  /** For `project`, `projectEdit` and `units`. */
  projectId?: number;
  /** For `inquiry`. */
  inquiryId?: string;
}

const SIMPLE_SECTIONS: AdminSection[] = [
  'overview',
  'projects',
  'units',
  'inquiries',
  'applications',
  'categories',
  'pastProjects',
  'cms',
  'users',
  'roles',
  'departments',
  'profile',
  'newsletter',
  'settings',
];

const PROJECT_SUBROUTES: Record<string, AdminSection> = {
  '': 'project',
  show: 'project',
  edit: 'projectEdit',
  units: 'units',
};

export function parseAdminPath(adminPath: string | undefined): AdminLocation {
  const segments = (adminPath ?? '').split('/').filter(Boolean);
  const [first, second, third] = segments;

  if (first?.toLowerCase() === 'inquiries' && second) {
    if (/^[A-Za-z0-9-]+$/.test(second) && segments.length <= 2) {
      return { section: 'inquiry', inquiryId: second };
    }
    return { section: 'inquiries' };
  }

  if (first?.toLowerCase() === 'projects' && second) {
    const projectId = Number(second);
    const section = PROJECT_SUBROUTES[(third ?? '').toLowerCase()];
    if (Number.isInteger(projectId) && projectId > 0 && section && segments.length <= 3) {
      return { section, projectId };
    }
    return { section: 'projects' };
  }

  const match = first
    ? SIMPLE_SECTIONS.find((candidate) => candidate.toLowerCase() === first.toLowerCase())
    : undefined;
  if (match) return { section: match };

  return { section: 'overview' };
}

export function buildAdminPath(location: AdminLocation): string {
  const { section, projectId, inquiryId } = location;
  if (projectId) {
    if (section === 'project') return `projects/${projectId}`;
    if (section === 'projectEdit') return `projects/${projectId}/edit`;
    if (section === 'units') return `projects/${projectId}/units`;
  }
  if (section === 'inquiry' && inquiryId) return `inquiries/${inquiryId}`;
  // Project/inquiry pages without an id fall back to the list.
  if (section === 'project' || section === 'projectEdit') return 'projects';
  if (section === 'inquiry') return 'inquiries';
  return section;
}

/** Which sidebar item is highlighted for a section. */
export function navSectionOf(section: AdminSection): AdminSection {
  if (section === 'project' || section === 'projectEdit') return 'projects';
  if (section === 'inquiry') return 'inquiries';
  return section;
}
