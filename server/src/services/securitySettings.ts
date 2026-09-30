import { config } from '../config/env.js';
import { prisma } from './prisma.js';

/**
 * Security policy edited by super admins. `LOGIN_OTP_REQUIRED` in `.env` still
 * wins: the setting can require the email code for everyone, never relax it.
 */

export interface SecuritySettings {
  /** Every admin must enter an emailed code at login, whatever their own toggle says. */
  loginOtpRequired: boolean;
}

export interface SecuritySettingsView extends SecuritySettings {
  /** True when `.env` already forces the code, so the switch cannot turn it off. */
  loginOtpForcedByEnv: boolean;
}

const SETTING_KEY = 'security';
const DEFAULTS: SecuritySettings = { loginOtpRequired: false };

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
  cached = { loginOtpRequired: stored.loginOtpRequired === true || DEFAULTS.loginOtpRequired };
  return cached;
}

export async function saveSecuritySettings(input: SecuritySettings, adminId: string): Promise<SecuritySettings> {
  const value = JSON.stringify(input);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
  cached = undefined;
  return getSecuritySettings();
}

export function toSecurityView(settings: SecuritySettings): SecuritySettingsView {
  return { ...settings, loginOtpForcedByEnv: config.loginOtpRequired };
}

/** The effective rule: `.env` or the admin setting. */
export async function loginOtpRequiredForAll(): Promise<boolean> {
  return config.loginOtpRequired || (await getSecuritySettings()).loginOtpRequired;
}
