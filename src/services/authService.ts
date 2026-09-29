import { api, clearAuthToken, getAuthToken, setAuthToken } from './api';
import type { AdminUser, AdminUserInput, AdminRole } from '../types/admin';

export interface AuthSession {
  token: string;
  user: AdminUser;
}

/** A session was issued and its token is already stored. */
export interface LoginSessionResult {
  kind: 'session';
  token: string;
  user: AdminUser;
}

/** Credentials were correct but a one-time code must be entered first. */
export interface LoginOtpResult {
  kind: 'otp';
  challengeId: string;
  /** Masked address, e.g. `aj***@gmail.com`, so the UI can confirm the account. */
  emailHint: string;
}

export type LoginResult = LoginSessionResult | LoginOtpResult;

/** Wire shape of `POST /api/auth/login`, which answers one of two bodies. */
type LoginResponseDto =
  | { token: string; user: UserDto }
  | { otpRequired: true; challengeId: string; emailHint: string };

interface UserDto {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  roleAr: string;
  roleId?: string | null;
  department: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: Record<string, boolean> | null;
  status: string;
  lastLogin: string | null;
  loginOtpEnabled?: boolean;
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
    phone: dto.phone ?? null,
    role: normalizeRole(dto.role),
    roleAr: dto.roleAr,
    roleId: dto.roleId ?? null,
    department: dto.department ?? '',
    departmentId: dto.departmentId ?? null,
    departmentName: dto.departmentName ?? dto.department ?? null,
    permissions: normalizePermissions(dto.permissions),
    lastLogin: dto.lastLogin ?? undefined,
    status: dto.status === 'suspended' ? 'suspended' : 'active',
    loginOtpEnabled: dto.loginOtpEnabled,
  };
}

export const authService = {
  /**
   * Begins a login. Returns `kind: 'session'` when no code is needed, otherwise
   * `kind: 'otp'` with the `challengeId` to pass to `verifyLoginOtp` — no token
   * is stored in that case.
   */
  async startLogin(email: string, password: string): Promise<LoginResult> {
    const result = await api.post<LoginResponseDto>('/api/auth/login', {
      email: email.trim(),
      password,
    });

    if ('otpRequired' in result && result.otpRequired) {
      return { kind: 'otp', challengeId: result.challengeId, emailHint: result.emailHint };
    }

    const { token, user } = result as { token: string; user: UserDto };
    setAuthToken(token);
    return { kind: 'session', token, user: toAdminUser(user) };
  },

  /**
   * Alias of {@link authService.startLogin}. Kept under the historical name so
   * existing call sites keep working; both return the same discriminated union.
   */
  login(email: string, password: string): Promise<LoginResult> {
    return this.startLogin(email, password);
  },

  /** Exchanges a login code for a session; stores the token like a plain login. */
  async verifyLoginOtp(challengeId: string, code: string): Promise<AuthSession> {
    const result = await api.post<{ token: string; user: UserDto }>('/api/auth/login/verify-otp', {
      challengeId,
      code: code.trim(),
    });

    setAuthToken(result.token);
    return { token: result.token, user: toAdminUser(result.user) };
  },

  /** Asks for a fresh login code. Throws an ApiError with status 429 if too soon. */
  resendLoginOtp(challengeId: string): Promise<{ sent: boolean }> {
    return api.post<{ sent: boolean }>('/api/auth/login/resend-otp', { challengeId });
  },

  /** Always resolves, whether or not the address has an account. */
  forgotPassword(email: string): Promise<{ sent: boolean }> {
    return api.post<{ sent: boolean }>('/api/auth/password/forgot', { email: email.trim() });
  },

  resetPassword(email: string, code: string, newPassword: string): Promise<{ reset: boolean }> {
    return api.post<{ reset: boolean }>('/api/auth/password/reset', {
      email: email.trim(),
      code: code.trim(),
      newPassword,
    });
  },

  /** Turns login OTP on/off for the signed-in admin; requires the current password. */
  setLoginOtp(enabled: boolean, password: string): Promise<{ loginOtpEnabled: boolean }> {
    return api.patch<{ loginOtpEnabled: boolean }>('/api/auth/me/login-otp', { enabled, password });
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

  /** The server revokes older tokens on a password change and returns a fresh one for this session. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const result = await api.post<{ message: string; token?: string }>('/api/auth/me/password', {
      currentPassword,
      newPassword,
    });
    if (result.token) setAuthToken(result.token);
    return { message: result.message };
  },
};

export const updateProfile = authService.updateProfile.bind(authService);
export const changePassword = authService.changePassword.bind(authService);
export const verifyLoginOtp = authService.verifyLoginOtp.bind(authService);
export const resendLoginOtp = authService.resendLoginOtp.bind(authService);
export const forgotPassword = authService.forgotPassword.bind(authService);
export const resetPassword = authService.resetPassword.bind(authService);
export const setLoginOtp = authService.setLoginOtp.bind(authService);

