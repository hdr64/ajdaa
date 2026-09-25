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

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleAr: string;
  department: string;
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
  department?: string | null;
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
