/**
 * Vocabulary and client-side mirror of the roles API
 * (`server/src/routes/roles.routes.ts`): the immutable role key format, which
 * permission only a super admin may hand out, which fields each kind of role
 * lets the current admin touch, and how the server's English error strings
 * become Arabic messages.
 *
 * Kept free of JSX so the cards, the table and the form can share it.
 */
import type { AdminPermissions, PermissionDef, Role } from '../../../types/admin';
import { ApiError, getErrorMessage } from '../../../services/api';
import { PERMISSION_LABELS, PERMISSION_EN_LABELS } from '../users/usersModel';
import { documentLanguage } from '../../../i18n/admin/core';

export type PermissionKey = keyof AdminPermissions;

/** Mirrors the server's `ROLE_KEY_REGEX`; the key can never change after create. */
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{2,40}$/;

export const ROLE_KEY_HINT = 'حرف إنجليزي صغير أول، ثم حروف صغيرة أو أرقام أو شرطة سفلية (3 أحرف على الأقل)';

export const getRoleKeyHint = (): string =>
  documentLanguage() === 'en'
    ? 'Starts with lowercase letter, then lowercase letters, numbers or underscores (min 3 chars)'
    : ROLE_KEY_HINT;

/** The one permission that escalates: only a super admin may put it in a role. */
export const MANAGE_USERS_KEY: PermissionKey = 'manageUsers';

/** Lets an admin mark a pending account verified without the emailed link or code. */
export const VERIFY_USERS_KEY: PermissionKey = 'verifyUsers';

export const MANAGE_USERS_HINT = 'منح صلاحية «إدارة المستخدمين» متاح لمدير عام النظام فقط';

export const getManageUsersHint = (): string =>
  documentLanguage() === 'en'
    ? 'Granting "Manage users" permission is restricted to Super Admin'
    : MANAGE_USERS_HINT;

export const VERIFY_USERS_HINT = 'منح صلاحية «تأكيد حسابات المستخدمين» متاح لمدير عام النظام فقط';

export const getVerifyUsersHint = (): string =>
  documentLanguage() === 'en'
    ? 'Granting "Verify users" permission is restricted to Super Admin'
    : VERIFY_USERS_HINT;

export const SYSTEM_ROLE_HINT = 'دور نظامي: الاسم والوصف فقط قابلان للتعديل';

export const getSystemRoleHint = (): string =>
  documentLanguage() === 'en'
    ? 'System role: only names and description can be modified'
    : SYSTEM_ROLE_HINT;

export const SYSTEM_DELETE_HINT = 'دور نظامي لا يمكن حذفه';

export const getSystemDeleteHint = (): string =>
  documentLanguage() === 'en'
    ? 'System roles cannot be deleted'
    : SYSTEM_DELETE_HINT;

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

/** Arabic/English permission names: the server catalogue first, built-ins as the fallback. */
export function permissionLabelsOf(definitions: PermissionDef[]): Record<PermissionKey, string> {
  const isEn = documentLanguage() === 'en';
  const labels: Record<PermissionKey, string> = { ...(isEn ? PERMISSION_EN_LABELS : PERMISSION_LABELS) };
  for (const definition of definitions) {
    labels[definition.key] = isEn && definition.labelEn ? definition.labelEn : definition.labelAr;
  }
  return labels;
}

export const roleUserCount = (role: Role): number => role.userCount ?? 0;

/* ------------------------------------------------------------------ *
 * Key validation
 * ------------------------------------------------------------------ */

/** Null when the key is acceptable, otherwise the localized reason. */
export function validateRoleKey(key: string): string | null {
  const value = key.trim();
  const isEn = documentLanguage() === 'en';
  if (value === '') return isEn ? 'Role key is required' : 'مفتاح الدور مطلوب';
  if (!ROLE_KEY_PATTERN.test(value)) return getRoleKeyHint();
  return null;
}

/** The key is immutable after creation, so the server would ignore it anyway. */
export function normalizeRoleKey(key: string): string {
  return key.trim().toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Server rules, mirrored in the UI
 * ------------------------------------------------------------------ */

export interface RoleRights {
  /** Names and description may be changed. */
  canEdit: boolean;
  editHint: string | null;
  /** The permission checkboxes are live (never for a system role). */
  permissionsEditable: boolean;
  /** Why the permission list is read-only, when it is. */
  permissionHint: string | null;
  /** Only a super admin may tick `manageUsers`. */
  canGrantManageUsers: boolean;
  canDelete: boolean;
  deleteHint: string | null;
}

/**
 * Mirrors the guards in `roles.routes.ts`: a system role keeps its permissions,
 * and any role holding `manageUsers` is a super-admin-only object — even for a
 * rename, since the server rejects the whole request.
 */
export function getRoleRights(role: Role, isSuperAdmin: boolean): RoleRights {
  const superAdminOnly = role.permissions.includes(MANAGE_USERS_KEY) && !isSuperAdmin;
  const manageUsersHint = getManageUsersHint();
  const systemRoleHint = getSystemRoleHint();
  const systemDeleteHint = getSystemDeleteHint();

  return {
    canEdit: !superAdminOnly,
    editHint: superAdminOnly ? manageUsersHint : null,
    permissionsEditable: !role.isSystem && !superAdminOnly,
    permissionHint: role.isSystem ? systemRoleHint : superAdminOnly ? manageUsersHint : null,
    canGrantManageUsers: isSuperAdmin,
    canDelete: !role.isSystem && !superAdminOnly,
    deleteHint: role.isSystem ? systemDeleteHint : superAdminOnly ? manageUsersHint : null,
  };
}

/* ------------------------------------------------------------------ *
 * Server errors, bilingual
 * ------------------------------------------------------------------ */

export interface ConflictCopy {
  /** 409 that carries the `userCount` the server attached to it. */
  inUse: (count: number) => string;
  /** 409 without a usable count. */
  inUseGeneric: string;
}

export const ROLE_IN_USE: ConflictCopy = {
  inUse: (count) =>
    documentLanguage() === 'en'
      ? `Cannot delete role: still assigned to ${count} user(s). Reassign them first.`
      : `لا يمكن حذف الدور: ما زال مُسنداً إلى ${count} مستخدم. انقلهم إلى دور آخر أولاً.`,
  inUseGeneric:
    documentLanguage() === 'en'
      ? 'Cannot delete role: still assigned to users. Reassign them first.'
      : 'لا يمكن حذف الدور: ما زال مُسنداً إلى مستخدمين. انقلهم إلى دور آخر أولاً.',
};

export const DEPARTMENT_IN_USE: ConflictCopy = {
  inUse: (count) =>
    documentLanguage() === 'en'
      ? `Cannot delete department: still assigned to ${count} user(s). Reassign them first.`
      : `لا يمكن حذف القسم: ما زال ${count} مستخدم مرتبطاً به. انقلهم إلى قسم آخر أولاً.`,
  inUseGeneric:
    documentLanguage() === 'en'
      ? 'Cannot delete department: still assigned to users. Reassign them first.'
      : 'لا يمكن حذف القسم: ما زال مرتبطاً بمستخدمين. انقلهم إلى قسم آخر أولاً.',
};

/** Per-operation wording, so each call site states its own consequence. */
export interface HrErrorCopy {
  /** 409 that carries the `userCount` the server attached to it. */
  conflict?: ConflictCopy;
  /** 409 without a usable count, e.g. a duplicated unique key. */
  conflictGeneric?: string;
  /** 400 — a field or state the server refuses. */
  badRequest?: string;
  /** 403 — reserved for super admins. */
  forbidden?: string;
}

const STATUS_MESSAGES_AR: Record<number, string> = {
  400: 'لا يمكن إتمام العملية على هذا السجل',
  403: 'هذه العملية متاحة لمدير عام النظام فقط',
  404: 'السجل المطلوب غير موجود أو تم حذفه',
  409: 'يوجد تعارض مع بيانات مسجلة مسبقاً',
};

const STATUS_MESSAGES_EN: Record<number, string> = {
  400: 'Cannot complete operation on this record',
  403: 'This operation is restricted to Super Admin',
  404: 'Record not found or already deleted',
  409: 'Conflict with existing data',
};

const SERVER_ERROR_MESSAGE_AR = 'تعذّر إتمام العملية على الخادم، حاول مجدداً بعد قليل.';
const SERVER_ERROR_MESSAGE_EN = 'Server error occurred, please try again shortly.';

export const ROLE_SAVE_ERROR: HrErrorCopy = {
  conflictGeneric:
    documentLanguage() === 'en'
      ? 'Another role exists with this key. Please choose a different key.'
      : 'يوجد دور آخر بنفس المفتاح. اختر مفتاحاً مختلفاً.',
  badRequest:
    documentLanguage() === 'en'
      ? 'Please check the name and key entered and try again.'
      : 'راجع الاسم والمفتاح المدخلين ثم أعد المحاولة.',
  forbidden: getManageUsersHint(),
};

export const ROLE_DELETE_ERROR: HrErrorCopy = {
  conflict: ROLE_IN_USE,
  badRequest: documentLanguage() === 'en' ? 'System roles cannot be deleted' : 'لا يمكن حذف دور نظامي',
  forbidden: getManageUsersHint(),
};

export const DEPARTMENT_SAVE_ERROR: HrErrorCopy = {
  conflictGeneric:
    documentLanguage() === 'en'
      ? 'Another department exists with this name. Please choose a different name.'
      : 'يوجد قسم آخر بنفس الاسم. اختر اسماً مختلفاً.',
};

export const DEPARTMENT_DELETE_ERROR: HrErrorCopy = { conflict: DEPARTMENT_IN_USE };

/** The `userCount` the server attaches to its 409 responses, when it sent one. */
function userCountOf(error: ApiError): number | null {
  const details = error.details;
  if (!details || typeof details !== 'object') return null;
  const count = (details as { userCount?: unknown }).userCount;
  return typeof count === 'number' && Number.isInteger(count) && count > 0 ? count : null;
}

/**
 * Server errors arrive in English; the toast has to say something the admin can
 * act on — the count of users still holding a role or a department included.
 */
export function hrErrorMessage(error: unknown, fallback: string, copy?: HrErrorCopy): string {
  if (!(error instanceof ApiError)) return getErrorMessage(error, fallback);

  const isEn = documentLanguage() === 'en';
  const statusMessages = isEn ? STATUS_MESSAGES_EN : STATUS_MESSAGES_AR;
  const serverErrorMessage = isEn ? SERVER_ERROR_MESSAGE_EN : SERVER_ERROR_MESSAGE_AR;

  if (error.status === 409) {
    const count = copy?.conflict ? userCountOf(error) : null;
    if (copy?.conflict && count !== null) return copy.conflict.inUse(count);
    return copy?.conflict?.inUseGeneric ?? copy?.conflictGeneric ?? statusMessages[409];
  }
  if (error.status === 400) return copy?.badRequest ?? statusMessages[400];
  if (error.status === 403) return copy?.forbidden ?? statusMessages[403];
  if (error.status >= 500) return serverErrorMessage;
  return statusMessages[error.status] ?? getErrorMessage(error, fallback);
}
