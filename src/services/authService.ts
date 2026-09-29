import { api, clearAuthToken, getAuthToken, setAuthToken } from './api';
import type { AdminUser, AdminUserInput, AdminRole } from '../types/admin';

export interface AuthSession {
  token: string;
  user: AdminUser;
}

interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  roleAr: string;
  roleId?: string | null;
  department: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: Record<string, boolean> | null;
  status: string;
  lastLogin: string | null;
}

const ROLES = ['super_admin', 'project_manager', 'sales_agent', 'viewer'] as const;
type KnownAdminRole = (typeof ROLES)[number];

export const DEFAULT_PERMISSIONS = {
  manageProjects: false,
  manageUnits: false,
  viewInquiries: false,
  exportData: false,
  manageUsers: false,
} as const;

/** The server stores an open-ended permission map; the UI needs a fixed shape. */
function normalizePermissions(raw: Record<string, boolean> | null | undefined) {
  const source = raw ?? {};
  return {
    manageProjects: source.manageProjects ?? false,
    manageUnits: source.manageUnits ?? false,
    viewInquiries: source.viewInquiries ?? false,
    exportData: source.exportData ?? false,
    manageUsers: source.manageUsers ?? false,
  };
}

function normalizeRole(raw: string): AdminRole {
  return (ROLES as readonly KnownAdminRole[]).includes(raw as KnownAdminRole) ? (raw as AdminRole) : 'viewer';
}

export function toAdminUser(dto: UserDto): AdminUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: normalizeRole(dto.role),
    roleAr: dto.roleAr,
    roleId: dto.roleId ?? null,
    department: dto.department ?? '',
    departmentId: dto.departmentId ?? null,
    departmentName: dto.departmentName ?? dto.department ?? null,
    permissions: normalizePermissions(dto.permissions),
    lastLogin: dto.lastLogin ?? undefined,
    status: dto.status === 'suspended' ? 'suspended' : 'active',
  };
}

export const authService = {
  /** Exchanges credentials for a JWT. The token is stored for later requests. */
  async login(email: string, password: string): Promise<AuthSession> {
    const result = await api.post<{ token: string; user: UserDto }>('/api/auth/login', {
      email: email.trim(),
      password,
    });

    setAuthToken(result.token);
    return { token: result.token, user: toAdminUser(result.user) };
  },

  /** Validates the stored token against the server. */
  async me(): Promise<AdminUser> {
    const result = await api.get<{ user: UserDto }>('/api/auth/me');
    return toAdminUser(result.user);
  },

  logout(): void {
    clearAuthToken();
  },

  /** Synchronous check used by the router. A stored token is not proof of validity. */
  hasToken(): boolean {
    return getAuthToken() !== null;
  },

  async listUsers(signal?: AbortSignal): Promise<AdminUser[]> {
    const users = await api.get<UserDto[]>('/api/auth/users', { signal });
    return users.map(toAdminUser);
  },

  async createUser(input: AdminUserInput): Promise<AdminUser> {
    const created = await api.post<UserDto>('/api/auth/users', input);
    return toAdminUser(created);
  },

  async updateUser(id: string, input: Partial<AdminUserInput>): Promise<AdminUser> {
    const updated = await api.put<UserDto>(`/api/auth/users/${encodeURIComponent(id)}`, input);
    return toAdminUser(updated);
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/auth/users/${encodeURIComponent(id)}`);
  },

  async setUserStatus(id: string, status: 'active' | 'suspended'): Promise<AdminUser> {
    const updated = await api.put<UserDto>(`/api/auth/users/${encodeURIComponent(id)}`, { status });
    return toAdminUser(updated);
  },

  async updateProfile(input: { name?: string; email?: string; phone?: string | null }): Promise<AdminUser> {
    const result = await api.patch<{ user: UserDto }>('/api/auth/me', input);
    return toAdminUser(result.user);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/api/auth/me/password', {
      currentPassword,
      newPassword,
    });
  },
};

export const updateProfile = authService.updateProfile.bind(authService);
export const changePassword = authService.changePassword.bind(authService);

