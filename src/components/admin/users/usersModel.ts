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
import { documentLanguage, translateCurrent } from '../../../i18n/admin/core';

/* ------------------------------------------------------------------ *
 * Roles, statuses, permissions
 * ------------------------------------------------------------------ */

/** Email validation pattern. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The fixed roles the shared types know about; custom roles still travel as their own key. */
const ADMIN_ROLES: readonly AdminRole[] = ['super_admin', 'project_manager', 'sales_agent', 'viewer'];

export const ROLE_AR_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام النظام (Super Admin)',
  project_manager: 'مدير التطوير والمشاريع',
  sales_agent: 'مسؤول تأجير ومبيعات',
  viewer: 'محلل استثماري ومتابع',
};

export const ROLE_EN_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  project_manager: 'Project & Development Manager',
  sales_agent: 'Sales & Leasing Agent',
  viewer: 'Investment Analyst / Viewer',
};

/** Roles that may only be granted by a super admin. */
export const SUPER_ADMIN_ROLE_KEY = 'super_admin';

export const DEFAULT_ROLE_KEY: AdminRole = 'sales_agent';

/** Permission keys double as the checkbox catalogue when `/api/permissions` is unavailable. */
export const PERMISSION_KEYS: readonly (keyof AdminPermissions)[] = [
  'manageProjects',
  'viewProjects',
  'createProject',
  'editProject',
  'deleteProject',
  'publishProject',
  'manageUnits',
  'viewInquiries',
  'viewApplications',
  'manageApplications',
  'exportData',
  'manageUsers',
  'verifyUsers',
  'manageNotifications',
  'manageCms',
  'manageClients',
  'managePastProjects',
  'rollbackCms',
];

export const PERMISSION_LABELS: Record<keyof AdminPermissions, string> = {
  manageProjects: 'إدارة المشاريع (كاملة)',
  viewProjects: 'استعراض المشاريع باللوحة',
  createProject: 'إضافة مشاريع جديدة',
  editProject: 'تعديل بيانات المشاريع',
  deleteProject: 'حذف المشاريع',
  publishProject: 'نشر وإخفاء المشاريع',
  manageUnits: 'تعديل الوحدات والأدوار',
  viewInquiries: 'متابعة طلبات العملاء',
  viewApplications: 'استعراض طلبات التوظيف',
  manageApplications: 'إدارة طلبات التوظيف',
  exportData: 'تصدير التقارير',
  manageUsers: 'إدارة المستخدمين',
  verifyUsers: 'تأكيد حسابات المستخدمين',
  manageNotifications: 'إدارة الإشعارات',
  manageCms: 'إدارة محتوى الموقع',
  manageClients: 'إدارة الشركاء والعملاء',
  managePastProjects: 'إدارة أعمالنا السابقة',
  rollbackCms: 'استعادة نسخ محتوى الموقع',
};

export const PERMISSION_EN_LABELS: Record<keyof AdminPermissions, string> = {
  manageProjects: 'Manage Projects (Full)',
  viewProjects: 'View Projects on Dashboard',
  createProject: 'Create New Projects',
  editProject: 'Edit Project Data',
  deleteProject: 'Delete Projects',
  publishProject: 'Publish / Hide Projects',
  manageUnits: 'Manage Units & Floors',
  viewInquiries: 'View Customer Inquiries',
  viewApplications: 'View Job Applications',
  manageApplications: 'Manage Job Applications',
  exportData: 'Export Reports',
  manageUsers: 'Manage Users',
  verifyUsers: 'Verify User Accounts',
  manageNotifications: 'Manage Notifications',
  manageCms: 'Manage Site Content',
  manageClients: 'Manage Partners & Clients',
  managePastProjects: 'Manage Past Projects',
  rollbackCms: 'Rollback CMS Versions',
};

export const getPermissionLabels = (): Record<keyof AdminPermissions, string> =>
  documentLanguage() === 'en' ? PERMISSION_EN_LABELS : PERMISSION_LABELS;

/** `PermissionDef.group` is an English slug on the server; show an Arabic heading. */
const PERMISSION_GROUP_LABELS: Record<string, string> = {
  projects: 'المشاريع',
  units: 'الوحدات والأدوار',
  inquiries: 'طلبات الاهتمام',
  reports: 'التقارير',
  users: 'المستخدمون',
  settings: 'الإعدادات',
  cms: 'محتوى الموقع (CMS)',
};

const PERMISSION_GROUP_EN_LABELS: Record<string, string> = {
  projects: 'Projects',
  units: 'Units & Floors',
  inquiries: 'Inquiries',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
  cms: 'Website Content (CMS)',
};

export const STATUS_LABELS: Record<AdminStatus, string> = {
  active: 'نشط',
  pending: 'بانتظار التفعيل',
  suspended: 'معطل',
};

export const STATUS_EN_LABELS: Record<AdminStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
};

export const userStatusLabel = (status: AdminStatus): string =>
  documentLanguage() === 'en' ? STATUS_EN_LABELS[status] : STATUS_LABELS[status];

/**
 * The statuses an admin may set through the toggle / bulk actions. `pending` is
 * deliberately excluded: it is server-managed (an account leaves it only by
 * opening the emailed verify link, or, for the initial activation, is created
 * active when it is a super admin), so no UI toggle may write it directly.
 */
export type ToggleableAdminStatus = 'active' | 'suspended';

/**
 * Mirrors the server's password policy
 * (`server/src/services/passwordPolicy.ts`): at least 10 characters, at least
 * one letter and at least one digit.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * The client-side mirror of the server's password policy. Returns the Arabic
 * error to show under the field, or `null` when the password is acceptable.
 * The server is the authority; this only keeps the form from sending a
 * password the API will reject.
 */
export function passwordPolicyError(password: string, isAr: boolean = documentLanguage() !== 'en'): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return isAr
      ? `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
      : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  // The same letter and digit checks as `meetsPasswordPolicy` on the server.
  if (!/\p{L}/u.test(password)) {
    return isAr
      ? 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل'
      : 'Password must contain at least one letter';
  }
  if (!/\d/.test(password)) {
    return isAr
      ? 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل'
      : 'Password must contain at least one digit';
  }
  return null;
}

/** Unbiased integer in [0, max) from the browser CSPRNG; every call is a fresh draw. */
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

/**
 * A password that always passes `passwordPolicyError`: one character from each
 * pool, the rest from all pools, then shuffled. Look-alike characters
 * (0/O, 1/l/I, quotes, slashes) are left out so it can be read aloud.
 */
export function generateSecurePassword(length = 14): string {
  const pools = ['ABCDEFGHJKMNPQRSTUVWXYZ', 'abcdefghjkmnpqrstuvwxyz', '23456789', '!@#$%^&'];
  const all = pools.join('');
  const chars = pools.map((pool) => pool[randomIndex(pool.length)]);
  while (chars.length < length) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'active', label: STATUS_LABELS.active },
  { value: 'suspended', label: STATUS_LABELS.suspended },
];

export const getStatusOptions = (): { value: string; label: string }[] => [
  { value: 'active', label: userStatusLabel('active') },
  { value: 'suspended', label: userStatusLabel('suspended') },
];

/** Sentinel for the "no department" option; `departmentId` is nullable on the wire. */
export const NO_DEPARTMENT = '__no_department__';
export const NO_DEPARTMENT_LABEL = 'بدون قسم';
export const getNoDepartmentLabel = (): string => translateCurrent('users.noDepartment');

/** Narrows a free-form role key to a known one; custom keys fall back to the default. */
export const toAdminRole = (key: string | null | undefined, fallback: AdminRole = DEFAULT_ROLE_KEY): AdminRole =>
  ADMIN_ROLES.includes(key as AdminRole) ? (key as AdminRole) : fallback;

export const countPermissions = (permissions: AdminPermissions): number =>
  PERMISSION_KEYS.filter((key) => permissions[key]).length;

export const emptyPermissions = (): AdminPermissions => ({
  manageProjects: false,
  viewProjects: false,
  createProject: false,
  editProject: false,
  deleteProject: false,
  publishProject: false,
  manageUnits: false,
  viewInquiries: false,
  viewApplications: false,
  manageApplications: false,
  exportData: false,
  manageUsers: false,
  verifyUsers: false,
  manageNotifications: false,
  manageCms: false,
  manageClients: false,
  managePastProjects: false,
  rollbackCms: false,
});

/** Pre-fills the checkboxes from a role, leaving every other permission off. */
export const permissionsFromRole = (role: Role | null): AdminPermissions => {
  const permissions = emptyPermissions();
  if (!role) return permissions;
  for (const key of PERMISSION_KEYS) permissions[key] = role.permissions.includes(key);
  return permissions;
};

export const SENSITIVE_PERMISSION_KEYS = new Set<keyof AdminPermissions>([
  'deleteProject',
  'manageUsers',
  'verifyUsers',
  'exportData',
  'manageNotifications',
  'rollbackCms',
]);

export function isSensitivePermission(key: keyof AdminPermissions): boolean {
  return SENSITIVE_PERMISSION_KEYS.has(key);
}

/** When a parent permission is toggled, it cascades to child permissions */
export const PERMISSION_DEPENDENCIES: Partial<Record<keyof AdminPermissions, (keyof AdminPermissions)[]>> = {
  manageProjects: ['viewProjects', 'createProject', 'editProject', 'deleteProject', 'publishProject', 'manageUnits'],
  editProject: ['viewProjects'],
  manageApplications: ['viewApplications'],
  manageCms: ['rollbackCms', 'manageClients', 'managePastProjects'],
};

export interface PermissionDiff {
  added: (keyof AdminPermissions)[];
  removed: (keyof AdminPermissions)[];
  isModified: boolean;
}

export function calculatePermissionDiff(current: AdminPermissions, role: Role | null): PermissionDiff {
  if (!role) {
    return { added: [], removed: [], isModified: false };
  }
  const rolePerms = new Set(role.permissions);
  const isSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;

  if (isSuperAdmin) {
    const removed = PERMISSION_KEYS.filter((key) => !current[key]);
    return { added: [], removed, isModified: removed.length > 0 };
  }

  const added = PERMISSION_KEYS.filter((key) => current[key] && !rolePerms.has(key));
  const removed = PERMISSION_KEYS.filter((key) => !current[key] && rolePerms.has(key));

  return {
    added,
    removed,
    isModified: added.length > 0 || removed.length > 0,
  };
}

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionDef[];
}

/** Groups the server catalogue in the order it arrives, so the form reads as sections. */
export function groupPermissions(definitions: PermissionDef[]): PermissionGroup[] {
  const isEn = documentLanguage() === 'en';
  const groupLabelMap = isEn ? PERMISSION_GROUP_EN_LABELS : PERMISSION_GROUP_LABELS;
  const groups = new Map<string, PermissionDef[]>();
  for (const definition of definitions) {
    const items = groups.get(definition.group);
    if (items) items.push(definition);
    else groups.set(definition.group, [definition]);
  }
  return [...groups].map(([key, items]) => ({
    key,
    label: groupLabelMap[key] ?? key,
    items,
  }));
}

export function summarizePermissions(
  permissions: AdminPermissions,
  definitions: PermissionDef[],
  isEn: boolean
): { totalCount: number; categoryBreakdown: string } {
  const activeKeys = PERMISSION_KEYS.filter((key) => permissions[key]);
  const totalCount = activeKeys.length;
  if (totalCount === 0) {
    return { totalCount: 0, categoryBreakdown: isEn ? 'No permissions granted' : 'لا توجد أي صلاحيات' };
  }

  const groups = groupPermissions(definitions);
  const parts: string[] = [];
  for (const group of groups) {
    const activeInGroup = group.items.filter((item) => permissions[item.key as keyof AdminPermissions]).length;
    if (activeInGroup > 0) {
      parts.push(`${group.label} (${activeInGroup})`);
    }
  }

  return {
    totalCount,
    categoryBreakdown: parts.join(' · '),
  };
}

/* ------------------------------------------------------------------ *
 * User-facing labels
 * ------------------------------------------------------------------ */

export const userRoleLabel = (user: AdminUser, roles: Role[]): string => {
  const isEn = documentLanguage() === 'en';
  const role = roles.find((r) => r.id === user.roleId);
  if (role) return isEn && role.nameEn ? role.nameEn : role.nameAr;
  if (user.role && user.role in ROLE_AR_LABELS) {
    return isEn ? ROLE_EN_LABELS[user.role as AdminRole] : ROLE_AR_LABELS[user.role as AdminRole];
  }
  return user.roleAr ?? user.role;
};

export const userDepartmentLabel = (user: AdminUser): string =>
  user.departmentName || user.department || translateCurrent('users.noDepartment');

export const lastActiveLabel = (user: AdminUser): string =>
  user.lastLogin ? formatRelativeTime(user.lastLogin) : translateCurrent('users.neverLoggedIn');

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
  /** Mark a pending account as verified without the emailed link or code. */
  canMarkVerified: boolean;
  markVerifiedHint: string | null;
  /** Clear another account's authenticator-app 2FA (lost phone). */
  canResetTotp: boolean;
  resetTotpHint: string | null;
  /** Clear another account's passkeys (lost device). */
  canResetPasskeys: boolean;
  resetPasskeysHint: string | null;
  isSelf: boolean;
}

export interface RightsContext {
  currentUserId: string | null;
  isSuperAdmin: boolean;
  /** The signed-in user holds `verifyUsers` (super admins always do). */
  canVerifyUsers: boolean;
  /** The signed-in user holds `manageUsers` (super admins always do). */
  canManageUsers: boolean;
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
  if (isSelf) return translateCurrent('users.lockSelf');
  if (isLastActiveSuperAdmin) return translateCurrent('users.lockLastSuperAdmin');
  if (!isSuperAdmin && user.role === SUPER_ADMIN_ROLE_KEY) return translateCurrent('users.lockSuperAdminOnly');
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

  const canMarkVerified =
    context.canVerifyUsers && user.status === 'pending' && !isSuperAdminTarget && !isSelf;
  let markVerifiedHint: string | null = null;
  if (!canMarkVerified) {
    if (!context.canVerifyUsers) markVerifiedHint = translateCurrent('users.hintReqVerifyPerm');
    else if (isSuperAdminTarget)
      markVerifiedHint = translateCurrent('users.hintSuperAdminVerify');
    else if (user.status !== 'pending')
      markVerifiedHint = translateCurrent('users.hintNotPending');
    else markVerifiedHint = translateCurrent('users.hintSelfVerify');
  }

  // Resetting someone else's second factor is a `manageUsers` action, and only a
  // super admin may touch a super admin's account.
  const canResetTotp =
    context.canManageUsers && Boolean(user.totpEnabled) && (!isSuperAdminTarget || context.isSuperAdmin);
  let resetTotpHint: string | null = null;
  if (!canResetTotp) {
    if (!context.canManageUsers) resetTotpHint = translateCurrent('users.hintReqManagePerm');
    else if (!user.totpEnabled) resetTotpHint = translateCurrent('users.hintTotpNotEnabled');
    else resetTotpHint = translateCurrent('users.lockSuperAdminOnly');
  }

  const canResetPasskeys =
    context.canManageUsers &&
    Boolean(user.passkeyCount && user.passkeyCount > 0) &&
    (!isSuperAdminTarget || context.isSuperAdmin);
  let resetPasskeysHint: string | null = null;
  if (!canResetPasskeys) {
    if (!context.canManageUsers) resetPasskeysHint = translateCurrent('users.hintReqManagePerm');
    else if (!user.passkeyCount) resetPasskeysHint = translateCurrent('users.hintNoPasskeys');
    else resetPasskeysHint = translateCurrent('users.lockSuperAdminOnly');
  }

  const canDelete = !isSelf && (!isSuperAdminTarget || context.isSuperAdmin) && !isLastActiveSuperAdmin;
  const deleteHint = canDelete
    ? null
    : isSelf
      ? translateCurrent('users.hintSelfDelete')
      : !context.isSuperAdmin && isSuperAdminTarget
        ? translateCurrent('users.lockSuperAdminOnly')
        : translateCurrent('users.hintLastSuperAdminDelete');

  return {
    canEdit: !isSuperAdminTarget || context.isSuperAdmin,
    editHint: isSuperAdminTarget && !context.isSuperAdmin ? translateCurrent('users.hintSuperAdminEdit') : null,
    accessLocked,
    lockReason: lockReason,
    canToggleStatus: !accessLocked,
    toggleHint: lockReason,
    canDelete,
    deleteHint,
    canMarkVerified,
    markVerifiedHint,
    canResetTotp,
    resetTotpHint,
    canResetPasskeys,
    resetPasskeysHint,
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
  /** Only reachable for pending accounts, so the row action is hidden otherwise. */
  onResendVerification: (user: AdminUser) => void;
  /** Mark a pending account as verified without the emailed link or code. */
  onMarkVerified: (user: AdminUser) => void;
  /** Clear an account's authenticator-app 2FA after a lost or replaced phone. */
  onResetTotp: (user: AdminUser) => void;
  /** Clear an account's passkeys after a lost device. */
  onResetPasskeys: (user: AdminUser) => void;
}
