import type { PropertyType } from './property';

export type AdminRole = 'super_admin' | 'project_manager' | 'sales_agent' | 'viewer';

export type AdminStatus = 'active' | 'suspended';

export interface AdminPermissions {
  manageProjects: boolean;
  manageUnits: boolean;
  viewInquiries: boolean;
  exportData: boolean;
  manageUsers: boolean;
}

export interface PermissionDef {
  key: keyof AdminPermissions;
  group: string;
  labelAr: string;
  labelEn: string;
  description: string;
}

export interface Role {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  permissions: (keyof AdminPermissions)[];
  isSystem: boolean;
  sortOrder: number;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleInput {
  key?: string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  permissions: (keyof AdminPermissions)[];
  sortOrder?: number;
  applyToUsers?: boolean;
}

export interface Department {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentInput {
  nameAr: string;
  nameEn?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleAr: string;
  roleId?: string | null;
  department: string;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: AdminPermissions;
  lastLogin?: string;
  status: AdminStatus;
}

/** Payload accepted by the user create/update endpoints. */
export interface AdminUserInput {
  name: string;
  email: string;
  password?: string;
  role: AdminRole;
  roleAr: string;
  roleId?: string | null;
  department?: string | null;
  departmentId?: string | null;
  permissions: Partial<AdminPermissions>;
  status?: AdminStatus;
}

export interface CategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  type: PropertyType;
  tags: string[];
}
