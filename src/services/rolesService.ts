import { api } from './api';
import type {
  Role,
  RoleInput,
  Department,
  DepartmentInput,
  PermissionDef,
} from '../types/admin';

export const rolesService = {
  // Permissions
  getPermissions(signal?: AbortSignal): Promise<PermissionDef[]> {
    return api.get<PermissionDef[]>('/api/permissions', { signal });
  },

  // Roles CRUD
  listRoles(signal?: AbortSignal): Promise<Role[]> {
    return api.get<Role[]>('/api/roles', { signal });
  },

  createRole(input: RoleInput): Promise<Role> {
    return api.post<Role>('/api/roles', input);
  },

  updateRole(id: string, input: Partial<RoleInput>): Promise<Role> {
    return api.put<Role>(`/api/roles/${encodeURIComponent(id)}`, input);
  },

  deleteRole(id: string): Promise<void> {
    return api.delete(`/api/roles/${encodeURIComponent(id)}`);
  },

  // Departments CRUD
  listDepartments(signal?: AbortSignal): Promise<Department[]> {
    return api.get<Department[]>('/api/departments', { signal });
  },

  createDepartment(input: DepartmentInput): Promise<Department> {
    return api.post<Department>('/api/departments', input);
  },

  updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
    return api.put<Department>(`/api/departments/${encodeURIComponent(id)}`, input);
  },

  deleteDepartment(id: string): Promise<void> {
    return api.delete(`/api/departments/${encodeURIComponent(id)}`);
  },
};
