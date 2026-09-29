/**
 * Vocabulary and rules shared by every view of the users section: Arabic labels,
 * the permission catalogue helpers, the lookup tables the `DataTable` filters
 * need, and the client-side mirror of the server's account rules
 * (`server/src/routes/auth.routes.ts`).
 *
 * Kept free of JSX so every view and the form can import it without dragging
 * components along, and free of `any` — custom roles travel as opaque keys.
 */
import type {
  AdminPermissions,
  AdminRole,
  AdminStatus,
  AdminUser,
  Department,
  PermissionDef,
  Role,
} from '../../../types/admin';
import { formatRelativeTime } from '../../../pages/admin/adminFormat';

/* ------------------------------------------------------------------ *
 * Roles, statuses, permissions
 * ------------------------------------------------------------------ */

/** The fixed roles the shared types know about; custom roles still travel as their own key. */
const ADMIN_ROLES: readonly AdminRole[] = ['super_admin', 'project_manager', 'sales_agent', 'viewer'];

export const ROLE_AR_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام النظام (Super Admin)',
  project_manager: 'مدير التطوير والمشاريع',
  sales_agent: 'مسؤول تأجير ومبيعات',
  viewer: 'محلل استثماري ومتابع',
};

/** Roles that may only be granted by a super admin. */
export const SUPER_ADMIN_ROLE_KEY = 'super_admin';

export const DEFAULT_ROLE_KEY: AdminRole = 'sales_agent';

/** Permission keys double as the checkbox catalogue when `/api/permissions` is unavailable. */
export const PERMISSION_KEYS: readonly (keyof AdminPermissions)[] = [
  'manageProjects',
  'manageUnits',
  'viewInquiries',
  'exportData',
  'manageUsers',
  'manageNotifications',
];

export const PERMISSION_LABELS: Record<keyof AdminPermissions, string> = {
  manageProjects: 'إدارة المشاريع',
  manageUnits: 'تعديل الوحدات',
  viewInquiries: 'متابعة الطلبات',
  exportData: 'تصدير التقارير',
  manageUsers: 'إدارة المستخدمين',
  manageNotifications: 'إدارة الإشعارات',
};

/** `PermissionDef.group` is an English slug on the server; show an Arabic heading. */
const PERMISSION_GROUP_LABELS: Record<string, string> = {
  projects: 'المشاريع',
  units: 'الوحدات والأدوار',
  inquiries: 'طلبات الاهتمام',
  reports: 'التقارير',
  users: 'المستخدمون',
  settings: 'الإعدادات',
};

export const STATUS_LABELS: Record<AdminStatus, string> = {
  active: 'نشط',
  suspended: 'معطل',
};

/** Matches the server's `password: z.string().min(8)`. */
export const MIN_PASSWORD_LENGTH = 8;

export const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'active', label: STATUS_LABELS.active },
  { value: 'suspended', label: STATUS_LABELS.suspended },
];

/** Sentinel for the "no department" option; `departmentId` is nullable on the wire. */
export const NO_DEPARTMENT = '__no_department__';
export const NO_DEPARTMENT_LABEL = 'بدون قسم';

/** Narrows a free-form role key to a known one; custom keys fall back to the default. */
export const toAdminRole = (key: string | null | undefined, fallback: AdminRole = DEFAULT_ROLE_KEY): AdminRole =>
  ADMIN_ROLES.includes(key as AdminRole) ? (key as AdminRole) : fallback;

export const countPermissions = (permissions: AdminPermissions): number =>
  PERMISSION_KEYS.filter((key) => permissions[key]).length;

export const emptyPermissions = (): AdminPermissions => ({
  manageProjects: false,
  manageUnits: false,
  viewInquiries: false,
  exportData: false,
  manageUsers: false,
  manageNotifications: false,
});

/** Pre-fills the checkboxes from a role, leaving every other permission off. */
export const permissionsFromRole = (role: Role | null): AdminPermissions => {
  const permissions = emptyPermissions();
  if (!role) return permissions;
  for (const key of PERMISSION_KEYS) permissions[key] = role.permissions.includes(key);
  return permissions;
};

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionDef[];
}

/** Groups the server catalogue in the order it arrives, so the form reads as sections. */
export function groupPermissions(definitions: PermissionDef[]): PermissionGroup[] {
  const groups = new Map<string, PermissionDef[]>();
  for (const definition of definitions) {
    const items = groups.get(definition.group);
    if (items) items.push(definition);
    else groups.set(definition.group, [definition]);
  }
  return [...groups].map(([key, items]) => ({
    key,
    label: PERMISSION_GROUP_LABELS[key] ?? key,
    items,
  }));
}

/* ------------------------------------------------------------------ *
 * User-facing labels
 * ------------------------------------------------------------------ */

export const userRoleLabel = (user: AdminUser, roles: Role[]): string =>
  roles.find((role) => role.id === user.roleId)?.nameAr ?? user.roleAr ?? ROLE_AR_LABELS[user.role];

export const userDepartmentLabel = (user: AdminUser): string =>
  user.departmentName || user.department || NO_DEPARTMENT_LABEL;

export const lastActiveLabel = (user: AdminUser): string =>
  user.lastLogin ? formatRelativeTime(user.lastLogin) : 'لم يسجل الدخول بعد';

export const userSearchText = (user: AdminUser): string =>
  [user.name, user.email, user.departmentName, user.department].filter(Boolean).join(' ');

export const isSuperAdminAccount = (user: AdminUser): boolean => user.role === SUPER_ADMIN_ROLE_KEY;

/* ------------------------------------------------------------------ *
 * Filter indexes
 * ------------------------------------------------------------------ */

export interface FilterOption {
  value: string;
  label: string;
}

export interface LookupIndex {
  /** The value the filter compares against, per user. */
  keyByUserId: Map<string, string>;
  options: FilterOption[];
}

/**
 * Resolves each user to the department record they belong to. Records created
 * before departments existed only carry the free-text name, so those are matched
 * by name; anything left over falls into the explicit "no department" option.
 */
export function buildDepartmentIndex(users: AdminUser[], departments: Department[]): LookupIndex {
  const idByName = new Map(departments.map((department) => [department.nameAr.trim(), department.id]));
  const keyByUserId = new Map<string, string>();

  for (const user of users) {
    const id =
      user.departmentId ??
      idByName.get((user.departmentName ?? user.department ?? '').trim()) ??
      NO_DEPARTMENT;
    keyByUserId.set(user.id, id);
  }

  return {
    keyByUserId,
    options: [
      ...departments.map((department) => ({ value: department.id, label: department.nameAr })),
      { value: NO_DEPARTMENT, label: NO_DEPARTMENT_LABEL },
    ],
  };
}

/**
 * Same idea for roles, except a user whose role has no matching record keeps its
 * own key as the filter value — otherwise that row could never be selected.
 */
export function buildRoleIndex(users: AdminUser[], roles: Role[]): LookupIndex {
  const idByKey = new Map(roles.map((role) => [role.key, role.id]));
  const keyByUserId = new Map<string, string>();
  const options: FilterOption[] = roles.map((role) => ({ value: role.id, label: role.nameAr }));
  const known = new Set(options.map((option) => option.value));

  for (const user of users) {
    const key = user.roleId ?? idByKey.get(user.role) ?? user.role;
    keyByUserId.set(user.id, key);
    if (!known.has(key)) {
      known.add(key);
      options.push({ value: key, label: user.roleAr ?? key });
    }
  }

  return { keyByUserId, options };
}

/* ------------------------------------------------------------------ *
 * Server rules, mirrored in the UI
 * ------------------------------------------------------------------ */

export interface UserRights {
  /** The edit form can be opened at all. */
  canEdit: boolean;
  editHint: string | null;
  /** Role, status and permissions are read-only for this account. */
  accessLocked: boolean;
  lockReason: string | null;
  canToggleStatus: boolean;
  toggleHint: string | null;
  canDelete: boolean;
  deleteHint: string | null;
  isSelf: boolean;
}

export interface RightsContext {
  currentUserId: string | null;
  isSuperAdmin: boolean;
  /** Guards the last usable super admin, who cannot be demoted, suspended or deleted. */
  activeSuperAdminCount: number;
}

/** Null when the admin may change role/status/permissions for this account. */
function accessLockReason(
  user: AdminUser,
  isSelf: boolean,
  isSuperAdmin: boolean,
  isLastActiveSuperAdmin: boolean
): string | null {
  if (isSelf) return 'لا يمكنك تغيير دورك أو حالتك أو صلاحياتك بنفسك';
  if (isLastActiveSuperAdmin) return 'لا يمكن تخفيض رتبة أو تعطيل آخر مدير عام نشط';
  if (!isSuperAdmin && user.role === SUPER_ADMIN_ROLE_KEY) return 'حسابات المدير العام متاحة لمدير عام فقط';
  return null;
}

/**
 * Mirrors the server guards so the UI never offers an action the API will reject:
 * holding `manageUsers` is not a path to a super admin, nobody edits their own
 * access, and the last active super admin keeps theirs.
 */
export function getUserRights(user: AdminUser, context: RightsContext): UserRights {
  const isSelf = context.currentUserId !== null && user.id === context.currentUserId;
  const isSuperAdminTarget = user.role === SUPER_ADMIN_ROLE_KEY;
  const isLastActiveSuperAdmin =
    isSuperAdminTarget && user.status === 'active' && context.activeSuperAdminCount <= 1;

  const lockReason = accessLockReason(user, isSelf, context.isSuperAdmin, isLastActiveSuperAdmin);
  const accessLocked = lockReason !== null;

  const canDelete = !isSelf && (!isSuperAdminTarget || context.isSuperAdmin) && !isLastActiveSuperAdmin;
  const deleteHint = canDelete
    ? null
    : isSelf
      ? 'لا يمكنك حذف حسابك'
      : !context.isSuperAdmin && isSuperAdminTarget
        ? 'حذف حسابات المدير العام متاح لمدير عام فقط'
        : 'لا يمكن حذف آخر مدير عام نشط من النظام';

  return {
    canEdit: !isSuperAdminTarget || context.isSuperAdmin,
    editHint: isSuperAdminTarget && !context.isSuperAdmin ? 'تعديل حسابات المدير العام متاح لمدير عام فقط' : null,
    accessLocked,
    lockReason: lockReason,
    canToggleStatus: !accessLocked,
    toggleHint: lockReason,
    canDelete,
    deleteHint,
    isSelf,
  };
}

/** Props every layout (table, grid, list) needs to render the same account. */
/** Everything the three layouts share; the grid adds its own permission labels. */
export interface UserViewProps {
  users: AdminUser[];
  rightsById: Map<string, UserRights>;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}
