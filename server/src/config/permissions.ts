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
    labelAr: 'إدارة المشاريع (كاملة)',
    labelEn: 'Manage Projects (All)',
    description: 'صلاحية كاملة لإضافة وتعديل وحذف ونشر المشاريع العقارية',
  },
  {
    key: 'viewProjects',
    group: 'projects',
    labelAr: 'استعراض المشاريع',
    labelEn: 'View Projects',
    description: 'عرض قائمة المشاريع باللوحة بما فيها المسودات والمشاريع المخفية',
  },
  {
    key: 'createProject',
    group: 'projects',
    labelAr: 'إضافة مشاريع جديدة',
    labelEn: 'Create Projects',
    description: 'إنشاء مشروع عقاري جديد كمسودة أو منشور',
  },
  {
    key: 'editProject',
    group: 'projects',
    labelAr: 'تعديل المشاريع',
    labelEn: 'Edit Projects',
    description: 'تعديل بيانات وأسعار ومواصفات المشاريع القائمة',
  },
  {
    key: 'deleteProject',
    group: 'projects',
    labelAr: 'حذف المشاريع',
    labelEn: 'Delete Projects',
    description: 'حذف مشروع عقاري من النظام',
  },
  {
    key: 'publishProject',
    group: 'projects',
    labelAr: 'نشر/إخفاء المشاريع',
    labelEn: 'Publish Projects',
    description: 'تبديل حالة النشر للمشروع (مسودة / منشور / مخفي)',
  },
  {
    key: 'manageCms',
    group: 'cms',
    labelAr: 'إدارة محتوى الموقع',
    labelEn: 'Manage CMS Content',
    description: 'تعديل نصوص وتنسيقات كافة صفحات الموقع والقوائم والتذييل',
  },
  {
    key: 'manageClients',
    group: 'cms',
    labelAr: 'إدارة الشركاء والعملاء',
    labelEn: 'Manage Partners & Clients',
    description: 'إضافة وتعديل وحذف الشركاء والعملاء وشعاراتهم وتصنيفاتهم',
  },
  {
    key: 'rollbackCms',
    group: 'cms',
    labelAr: 'استعادة نسخ المحتوى السابقة',
    labelEn: 'Rollback CMS Versions',
    description: 'استرجاع نسخة سابقة من محتوى الأقسام بنقرة زر',
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
  {
    key: 'manageNotifications',
    group: 'settings',
    labelAr: 'إدارة الإشعارات',
    labelEn: 'Manage Notifications',
    description: 'تحديد من يُبلَّغ عند وصول طلب اهتمام جديد وإضافة مستمعين للأحداث',
  },
] as const;

export const PERMISSION_KEYS = [
  'manageProjects',
  'viewProjects',
  'createProject',
  'editProject',
  'deleteProject',
  'publishProject',
  'manageCms',
  'manageClients',
  'rollbackCms',
  'manageUnits',
  'viewInquiries',
  'exportData',
  'manageUsers',
  'manageNotifications',
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
