import { api, clearAuthToken, getAuthToken, setAuthToken } from './api';
import type { AdminUser, AdminUserInput, AdminRole, AdminStatus } from '../types/admin';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

export interface PasskeyItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType?: string | null;
  backedUp: boolean;
}

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

/** Credentials were correct but the authenticator-app code (or a recovery code) is needed. */
export interface LoginTotpResult {
  kind: 'totp';
  challengeId: string;
  emailHint: string;
}

/**
 * The account must set up an authenticator app before it may sign in. The token
 * is scope-limited: it only reaches `/api/auth/login/enroll-totp/*` and is never
 * stored as a session.
 */
export interface LoginTotpEnrollResult {
  kind: 'totpEnroll';
  enrollToken: string;
  emailHint: string;
}

export type LoginResult = LoginSessionResult | LoginOtpResult | LoginTotpResult | LoginTotpEnrollResult;

/** Wire shape of `POST /api/auth/login`, which answers one of four bodies. */
type LoginResponseDto =
  | { token: string; user: UserDto }
  | { otpRequired: true; challengeId: string; emailHint: string }
  | { totpRequired: true; challengeId: string; emailHint: string }
  | { totpEnrollmentRequired: true; enrollToken: string; emailHint: string };

interface UserDto {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
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
  totpEnabled?: boolean;
  recoveryCodesLeft?: number;
  passkeyCount?: number;
}

const ROLES = ['super_admin', 'project_manager', 'sales_agent', 'viewer'] as const;
type KnownAdminRole = (typeof ROLES)[number];

export const DEFAULT_PERMISSIONS = {
  manageProjects: false,
  viewProjects: false,
  createProject: false,
  editProject: false,
  deleteProject: false,
  publishProject: false,
  manageUnits: false,
  viewInquiries: false,
  exportData: false,
  manageUsers: false,
  verifyUsers: false,
  manageNotifications: false,
  manageCms: false,
  manageClients: false,
  managePastProjects: false,
  rollbackCms: false,
} as const;

/** The server stores an open-ended permission map; the UI needs a fixed shape. */
function normalizePermissions(raw: Record<string, boolean> | null | undefined) {
  const source = raw ?? {};
  return {
    manageProjects: source.manageProjects ?? false,
    viewProjects: source.viewProjects ?? source.manageProjects ?? false,
    createProject: source.createProject ?? source.manageProjects ?? false,
    editProject: source.editProject ?? source.manageProjects ?? false,
    deleteProject: source.deleteProject ?? source.manageProjects ?? false,
    publishProject: source.publishProject ?? source.manageProjects ?? false,
    manageUnits: source.manageUnits ?? false,
    viewInquiries: source.viewInquiries ?? false,
    exportData: source.exportData ?? false,
    manageUsers: source.manageUsers ?? false,
    verifyUsers: source.verifyUsers ?? false,
    manageNotifications: source.manageNotifications ?? false,
    manageCms: source.manageCms ?? false,
    manageClients: source.manageClients ?? source.manageCms ?? false,
    managePastProjects: source.managePastProjects ?? false,
    rollbackCms: source.rollbackCms ?? false,
    viewApplications: source.viewApplications ?? false,
    manageApplications: source.manageApplications ?? false,
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
    avatar: dto.avatar ?? null,
    role: normalizeRole(dto.role),
    roleAr: dto.roleAr,
    roleId: dto.roleId ?? null,
    department: dto.department ?? '',
    departmentId: dto.departmentId ?? null,
    departmentName: dto.departmentName ?? dto.department ?? null,
    permissions: normalizePermissions(dto.permissions),
    lastLogin: dto.lastLogin ?? undefined,
    status: dto.status === 'suspended' ? 'suspended' : dto.status === 'pending' ? 'pending' : 'active',
    loginOtpEnabled: dto.loginOtpEnabled,
    totpEnabled: dto.totpEnabled ?? false,
    recoveryCodesLeft: dto.recoveryCodesLeft ?? 0,
    passkeyCount: dto.passkeyCount ?? 0,
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

    if ('totpRequired' in result && result.totpRequired) {
      return { kind: 'totp', challengeId: result.challengeId, emailHint: result.emailHint };
    }

    if ('totpEnrollmentRequired' in result && result.totpEnrollmentRequired) {
      return { kind: 'totpEnroll', enrollToken: result.enrollToken, emailHint: result.emailHint };
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

  /** Exchanges an authenticator-app code (or a recovery code) for a session. */
  async verifyLoginTotp(challengeId: string, code: string): Promise<AuthSession & { recoveryCodesLeft?: number }> {
    const result = await api.post<{ token: string; user: UserDto; recoveryCodesLeft?: number }>(
      '/api/auth/login/verify-totp',
      { challengeId, code: code.trim() }
    );
    setAuthToken(result.token);
    return { token: result.token, user: toAdminUser(result.user), recoveryCodesLeft: result.recoveryCodesLeft };
  },

  /** Step 1 of mandatory enrollment: returns the QR payload for the scope-limited token. */
  enrollTotpSetup(enrollToken: string): Promise<{ otpauthUri: string; secret: string }> {
    return api.post<{ otpauthUri: string; secret: string }>(
      '/api/auth/login/enroll-totp/setup',
      undefined,
      { authToken: enrollToken }
    );
  },

  /** Step 2 of mandatory enrollment: proves the code, enables TOTP and starts a session. */
  async enrollTotpVerify(
    enrollToken: string,
    code: string
  ): Promise<AuthSession & { recoveryCodes: string[] }> {
    const result = await api.post<{ token: string; user: UserDto; recoveryCodes: string[] }>(
      '/api/auth/login/enroll-totp/verify',
      { code: code.trim() },
      { authToken: enrollToken }
    );
    setAuthToken(result.token);
    return { token: result.token, user: toAdminUser(result.user), recoveryCodes: result.recoveryCodes };
  },

  /** Starts self-service enrollment: returns the secret and `otpauth://` URI once. */
  totpSetup(currentPassword: string): Promise<{ otpauthUri: string; secret: string }> {
    return api.post<{ otpauthUri: string; secret: string }>('/api/auth/me/totp/setup', { currentPassword });
  },

  /** Confirms the pending secret and returns the one-time recovery codes. */
  totpEnable(code: string): Promise<{ recoveryCodes: string[] }> {
    return api.post<{ recoveryCodes: string[] }>('/api/auth/me/totp/enable', { code: code.trim() });
  },

  /** Switches TOTP off; requires the current password and a live TOTP/recovery code. */
  totpDisable(currentPassword: string, code: string): Promise<{ disabled: boolean }> {
    return api.post<{ disabled: boolean }>('/api/auth/me/totp/disable', {
      currentPassword,
      code: code.trim(),
    });
  },

  /** Replaces the recovery codes with a fresh set. */
  regenerateRecoveryCodes(currentPassword: string, code: string): Promise<{ recoveryCodes: string[] }> {
    return api.post<{ recoveryCodes: string[] }>('/api/auth/me/totp/recovery-codes', {
      currentPassword,
      code: code.trim(),
    });
  },

  /** Clears another admin's TOTP so a lost phone cannot lock them out (needs `manageUsers`). */
  resetUserTotp(userId: string): Promise<{ reset: boolean }> {
    return api.post<{ reset: boolean }>(`/api/auth/users/${encodeURIComponent(userId)}/reset-totp`, {});
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

  async createUser(input: AdminUserInput): Promise<{ user: AdminUser; mailSent: boolean }> {
    const created = await api.post<UserDto & { mailSent?: boolean }>('/api/auth/users', input);
    // `mailSent: false` means no confirmation/invite mail left the server, so the
    // UI should offer a resend instead of pretending the user was emailed.
    return { user: toAdminUser(created), mailSent: created.mailSent ?? true };
  },

  async updateUser(id: string, input: Partial<AdminUserInput>): Promise<AdminUser> {
    const updated = await api.put<UserDto>(`/api/auth/users/${encodeURIComponent(id)}`, input);
    return toAdminUser(updated);
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/auth/users/${encodeURIComponent(id)}`);
  },

  async setUserStatus(id: string, status: AdminStatus): Promise<AdminUser> {
    const updated = await api.put<UserDto>(`/api/auth/users/${encodeURIComponent(id)}`, { status });
    return toAdminUser(updated);
  },

  async updateProfile(input: { name?: string; email?: string; phone?: string | null; avatar?: string | null }): Promise<AdminUser> {
    const result = await api.patch<{ user: UserDto }>('/api/auth/me', input);
    return toAdminUser(result.user);
  },

  async uploadAvatar(file: File): Promise<AdminUser> {
    const formData = new FormData();
    formData.append('file', file);
    const result = await api.upload<{ avatar: string; user: UserDto }>('/api/auth/me/avatar', formData);
    return toAdminUser(result.user);
  },

  async deleteAvatar(): Promise<AdminUser> {
    const result = await api.delete<{ success: boolean; user: UserDto }>('/api/auth/me/avatar');
    return toAdminUser(result.user);
  },

  /** The server revokes older tokens on a password change and returns a fresh one for this session. */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmation?: { challengeId: string; code: string }
  ): Promise<{ message: string }> {
    const result = await api.post<{ message: string; token?: string }>('/api/auth/me/password', {
      currentPassword,
      newPassword,
      challengeId: confirmation?.challengeId,
      code: confirmation?.code,
    });
    if (result.token) setAuthToken(result.token);
    return { message: result.message };
  },

  /** Step 1 of a self-service password change: emails a confirmation code. */
  requestPasswordChange(currentPassword: string, newPassword: string): Promise<{ challengeId: string; emailHint: string }> {
    return api.post<{ challengeId: string; emailHint: string }>('/api/auth/me/password/request', {
      currentPassword,
      newPassword,
    });
  },

  /** Confirms a create-mode account's email with the emailed one-time token. */
  verifyEmail(token: string): Promise<{ verified: boolean }> {
    return api.post<{ verified: boolean }>('/api/auth/verify-email', { token });
  },

  /** Accepts an invite: verifies the address and sets the first password. */
  acceptInvite(token: string, password: string): Promise<{ activated: boolean }> {
    return api.post<{ activated: boolean }>('/api/auth/accept-invite', { token, password });
  },

  /** Re-sends a pending account's invite/verification link (needs `manageUsers`). */
  resendVerification(id: string): Promise<{ sent: boolean }> {
    return api.post<{ sent: boolean }>(`/api/auth/users/${encodeURIComponent(id)}/resend-verification`, {});
  },

  /** Verifies a pending create-mode account with its emailed 6-digit code. */
  verifyEmailCode(email: string, password: string, code: string): Promise<{ verified: boolean }> {
    return api.post<{ verified: boolean }>('/api/auth/verify-email-code', {
      email: email.trim(),
      password,
      code: code.trim(),
    });
  },

  /** Re-sends a fresh email verification code (and link) for a pending account. */
  resendVerificationCode(email: string, password: string): Promise<{ sent: boolean }> {
    return api.post<{ sent: boolean }>('/api/auth/verify-email-code/resend', {
      email: email.trim(),
      password,
    });
  },

  /** Marks a pending account as verified without the emailed link or code (needs `verifyUsers`). */
  markVerified(userId: string): Promise<{ verified: boolean; needsPassword: boolean }> {
    return api.post<{ verified: boolean; needsPassword: boolean }>(
      `/api/auth/users/${encodeURIComponent(userId)}/mark-verified`,
      {}
    );
  },

  /** WebAuthn: Generates registration options (requires current password). */
  getPasskeyRegisterOptions(currentPassword: string): Promise<{ options: PublicKeyCredentialCreationOptionsJSON }> {
    return api.post<{ options: PublicKeyCredentialCreationOptionsJSON }>('/api/auth/passkeys/register/options', {
      currentPassword,
    });
  },

  /** WebAuthn: Verifies and persists a newly registered passkey. */
  verifyPasskeyRegister(response: RegistrationResponseJSON, name?: string): Promise<{ passkey: PasskeyItem }> {
    return api.post<{ passkey: PasskeyItem }>('/api/auth/passkeys/register/verify', {
      response,
      name,
    });
  },

  /** WebAuthn: Generates login options (public). */
  getPasskeyLoginOptions(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
    return api.post<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>(
      '/api/auth/passkeys/login/options',
      {}
    );
  },

  /** WebAuthn: Verifies passkey assertion and signs in (public). */
  verifyPasskeyLogin(
    challengeId: string,
    response: AuthenticationResponseJSON
  ): Promise<LoginSessionResult> {
    return api
      .post<{ token: string; user: UserDto }>('/api/auth/passkeys/login/verify', { challengeId, response })
      .then((res) => {
        setAuthToken(res.token);
        return { kind: 'session' as const, token: res.token, user: toAdminUser(res.user) };
      });
  },

  /** Lists current admin's registered passkeys. */
  listPasskeys(): Promise<{ passkeys: PasskeyItem[] }> {
    return api.get<{ passkeys: PasskeyItem[] }>('/api/auth/passkeys');
  },

  /** Renames a passkey owned by the caller. */
  renamePasskey(id: string, name: string): Promise<{ passkey: PasskeyItem }> {
    return api.patch<{ passkey: PasskeyItem }>(`/api/auth/passkeys/${encodeURIComponent(id)}`, { name });
  },

  /** Deletes a passkey owned by the caller (requires current password). */
  deletePasskey(id: string, currentPassword: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/auth/passkeys/${encodeURIComponent(id)}`, {
      currentPassword,
    });
  },

  /** Admin helper: resets all passkeys for another user (`manageUsers`). */
  resetPasskeys(userId: string): Promise<{ reset: boolean; count: number }> {
    return api.post<{ reset: boolean; count: number }>(
      `/api/auth/users/${encodeURIComponent(userId)}/reset-passkeys`,
      {}
    );
  },
};

export const updateProfile = authService.updateProfile.bind(authService);
export const changePassword = authService.changePassword.bind(authService);
export const verifyLoginOtp = authService.verifyLoginOtp.bind(authService);
export const resendLoginOtp = authService.resendLoginOtp.bind(authService);
export const forgotPassword = authService.forgotPassword.bind(authService);
export const resetPassword = authService.resetPassword.bind(authService);
export const setLoginOtp = authService.setLoginOtp.bind(authService);
export const verifyLoginTotp = authService.verifyLoginTotp.bind(authService);
export const getPasskeyRegisterOptions = authService.getPasskeyRegisterOptions.bind(authService);
export const verifyPasskeyRegister = authService.verifyPasskeyRegister.bind(authService);
export const getPasskeyLoginOptions = authService.getPasskeyLoginOptions.bind(authService);
export const verifyPasskeyLogin = authService.verifyPasskeyLogin.bind(authService);
export const listPasskeys = authService.listPasskeys.bind(authService);
export const renamePasskey = authService.renamePasskey.bind(authService);
export const deletePasskey = authService.deletePasskey.bind(authService);
export const uploadAvatar = authService.uploadAvatar.bind(authService);
export const deleteAvatar = authService.deleteAvatar.bind(authService);
export const resetPasskeys = authService.resetPasskeys.bind(authService);


/** Reversible on/off actions an admin may choose "don't ask again" for (the server rejects any other). */
export type ConfirmAction = 'user.status' | 'project.publish' | 'inquiry.status' | 'listener.enabled';

export interface AdminPreferences {
  skipConfirm: ConfirmAction[];
}

export const preferencesService = {
  get(signal?: AbortSignal): Promise<AdminPreferences> {
    return api.get<AdminPreferences>('/api/auth/me/preferences', { signal });
  },

  save(preferences: AdminPreferences): Promise<AdminPreferences> {
    return api.put<AdminPreferences>('/api/auth/me/preferences', preferences);
  },
};
