import type { PropertyType } from './property';

export type AdminRole = 'super_admin' | 'project_manager' | 'sales_agent' | 'viewer';

export type AdminStatus = 'active' | 'pending' | 'suspended';

export interface AdminPermissions {
  manageProjects: boolean;
  viewProjects: boolean;
  createProject: boolean;
  editProject: boolean;
  deleteProject: boolean;
  publishProject: boolean;
  manageCms: boolean;
  manageClients: boolean;
  managePastProjects: boolean;
  rollbackCms: boolean;
  manageUnits: boolean;
  viewInquiries: boolean;
  viewApplications: boolean;
  manageApplications: boolean;
  exportData: boolean;
  manageUsers: boolean;
  verifyUsers: boolean;
  manageNotifications: boolean;
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
  phone?: string | null;
  avatar?: string | null;
  role: AdminRole;
  roleAr: string;
  roleId?: string | null;
  department: string;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: AdminPermissions;
  lastLogin?: string;
  status: AdminStatus;
  loginOtpEnabled?: boolean;
  /** Authenticator-app (TOTP) 2FA is switched on for this account. */
  totpEnabled?: boolean;
  /** Unused recovery codes remaining; shown on the profile 2FA card. */
  recoveryCodesLeft?: number;
  /** Number of registered WebAuthn passkeys for this account. */
  passkeyCount?: number;
}

/** Payload accepted by the user create/update endpoints. */
export interface AdminUserInput {
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  password?: string;
  /** 'create' keeps the admin-set-password flow; 'invite' emails a self-service link. */
  mode?: 'create' | 'invite';
  role: AdminRole;
  roleAr: string;
  roleId?: string | null;
  department?: string | null;
  departmentId?: string | null;
  permissions: Partial<AdminPermissions>;
  status?: AdminStatus;
  /** Create mode only: email the admin-typed password in a separated block. */
  sendPasswordInEmail?: boolean;
}

export interface CategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  type: PropertyType;
  tags: string[];
}
