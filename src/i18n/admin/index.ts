import { applications } from './applications';
import { auth } from './auth';
import { categories } from './categories';
import { charts } from './charts';
import { cms } from './cms';
import { common } from './common';
import { dashboard } from './dashboard';
import { departments } from './departments';
import { feedback } from './feedback';
import { floorplan } from './floorplan';
import { inquiries } from './inquiries';
import { layout } from './layout';
import { mail } from './mail';
import { newsletter } from './newsletter';
import { pastProjects } from './pastProjects';
import { profile } from './profile';
import { projectEdit } from './projectEdit';
import { projects } from './projects';
import { roles } from './roles';
import { settings } from './settings';
import { users } from './users';

/**
 * Every admin translation area in one object. `translateAdmin` resolves keys
 * through the registry in `core.ts`; this aggregate exists so `AdminKey` is
 * derived from the real key sets, which makes a missing or misspelled key a
 * compile error instead of a silent fallback.
 */
export const adminStrings = {
  applications,
  auth,
  categories,
  charts,
  cms,
  common,
  dashboard,
  departments,
  feedback,
  floorplan,
  inquiries,
  layout,
  mail,
  newsletter,
  pastProjects,
  profile,
  projectEdit,
  projects,
  roles,
  settings,
  users,
};

export type AdminArea = keyof typeof adminStrings;

/** Full key, `<area>.<key>`, e.g. `users.wizard.next`. */
export type AdminKey = {
  [Area in AdminArea]: `${Area & string}.${Extract<keyof (typeof adminStrings)[Area]['ar'], string>}`;
}[AdminArea];

export { useAdminT, type AdminTranslation } from './useAdminT';

