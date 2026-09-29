import { z } from 'zod';
import type { AdminPermission } from '../types/fastify.js';

export interface PermissionDef {
  key: AdminPermission;
  group: string;
  labelAr: string;
  labelEn: string;
  description: string;
}

export const PERMISSION_CATALOGUE: readonly PermissionDef[] = [
  {
    key: 'manageProjects',
    group: 'projects',
    labelAr: 'إدارة المشاريع',
    labelEn: 'Manage Projects',
    description: 'إضافة وتعديل وحذف المشاريع العقارية',
  },
  {
    key: 'manageUnits',
    group: 'units',
    labelAr: 'إدارة الوحدات والأدوار',
    labelEn: 'Manage Units & Floors',
    description: 'تعديل الأدوار وتبديل حالة الوحدات (متاح/مؤجر/محجوز)',
  },
  {
    key: 'viewInquiries',
    group: 'inquiries',
    labelAr: 'استعراض الطلبات',
    labelEn: 'View Inquiries',
    description: 'متابعة وتحديث حالات طلبات الاهتمام الواردة',
  },
  {
    key: 'exportData',
    group: 'reports',
    labelAr: 'تصدير البيانات',
    labelEn: 'Export Data',
    description: 'تصدير التقارير وسجلات العقود والبيانات',
  },
  {
    key: 'manageUsers',
    group: 'users',
    labelAr: 'إدارة المستخدمين',
    labelEn: 'Manage Users',
    description: 'إدارة المستخدمين وتوزيع الصلاحيات',
  },
] as const;

export const PERMISSION_KEYS = [
  'manageProjects',
  'manageUnits',
  'viewInquiries',
  'exportData',
  'manageUsers',
] as const;

export const permissionKeySchema = z.enum(PERMISSION_KEYS);
export type PermissionKey = z.infer<typeof permissionKeySchema>;

export function parseRolePermissions(value: string | null | undefined): PermissionKey[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PermissionKey =>
      PERMISSION_KEYS.includes(item as PermissionKey)
    );
  } catch {
    return [];
  }
}

export function rolePermissionsToUserPermissions(rolePermsArray: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    result[key] = rolePermsArray.includes(key);
  }
  return result;
}

/**
 * Parses the per-user permission map (`AdminUser.permissions`), which is a JSON
 * object rather than a role's array. A malformed or non-object value grants
 * nothing, so a corrupted row can never widen access.
 */
export function parsePermissions(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}
