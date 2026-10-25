import { config } from '../config/env.js';
import { prisma } from './prisma.js';

/**
 * Security policy edited by super admins. `LOGIN_OTP_REQUIRED` in `.env` still
 * wins: the setting can require the email code for everyone, never relax it.
 */

export interface SecuritySettings {
  /** Every admin must enter an emailed code at login, whatever their own toggle says. */
  loginOtpRequired: boolean;
  /** Every admin must enable TOTP at next login, whatever their own toggle says. */
  totpRequiredForAll: boolean;
}

export interface SecuritySettingsView extends SecuritySettings {
  /** True when `.env` already forces the code, so the switch cannot turn it off. */
  loginOtpForcedByEnv: boolean;
  /** True when `.env` already forces TOTP (currently no .env flag, always false). */
  totpForcedByEnv: boolean;
}

const SETTING_KEY = 'security';
const DEFAULTS: SecuritySettings = { loginOtpRequired: false, totpRequiredForAll: false };

let cached: SecuritySettings | undefined;

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  let stored: Partial<SecuritySettings> = {};
  try {
    stored = row ? (JSON.parse(row.value) as Partial<SecuritySettings>) : {};
  } catch {
    // A corrupted row falls back to the defaults (the .env policy still applies).
  }
  cached = {
    loginOtpRequired: stored.loginOtpRequired === true || DEFAULTS.loginOtpRequired,
    totpRequiredForAll: stored.totpRequiredForAll === true || DEFAULTS.totpRequiredForAll,
  };
  return cached;
}

/**
 * Persists a partial update: a caller that only knows about one switch (the
 * older email-code form, for instance) must not silently reset the other.
 */
export async function saveSecuritySettings(
  input: Partial<SecuritySettings>,
  adminId: string
): Promise<SecuritySettings> {
  const current = await getSecuritySettings();
  const next: SecuritySettings = {
    loginOtpRequired: input.loginOtpRequired ?? current.loginOtpRequired,
    totpRequiredForAll: input.totpRequiredForAll ?? current.totpRequiredForAll,
  };
  const value = JSON.stringify(next);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
  cached = undefined;
  return getSecuritySettings();
}

export function toSecurityView(settings: SecuritySettings): SecuritySettingsView {
  return { ...settings, loginOtpForcedByEnv: config.loginOtpRequired, totpForcedByEnv: false };
}

/** The effective rule: `.env` or the admin setting (emailed code). */
export async function loginOtpRequiredForAll(): Promise<boolean> {
  return config.loginOtpRequired || (await getSecuritySettings()).loginOtpRequired;
}

/** The effective rule: `.env` or the admin setting (TOTP). */
export async function totpRequiredForAll(): Promise<boolean> {
  return (await getSecuritySettings()).totpRequiredForAll;
}
