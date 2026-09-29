import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { decryptSecret, encryptSecret } from './secretBox.js';

/**
 * SMTP settings, editable from the admin.
 *
 * A saved `AppSetting` row ("mail") overrides the `MAIL_*` values from `.env`;
 * deleting it falls back to them. The password is stored encrypted
 * (`passwordBox`) and never leaves this module except to build a transport.
 */

export type MailEncryption = 'tls' | 'ssl' | 'none';

export interface MailSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: MailEncryption;
  fromAddress: string;
  fromName: string;
}

export interface EffectiveMailSettings extends MailSettings {
  source: 'database' | 'env';
}

/** `password`: undefined keeps the current one, '' clears it. */
export type MailSettingsInput = Omit<MailSettings, 'password'> & { password?: string };

export interface MailSettingsView extends Omit<MailSettings, 'password'> {
  passwordSet: boolean;
  source: 'database' | 'env';
  deliveryEnabled: boolean;
}

interface StoredMailSettings extends Omit<MailSettings, 'password'> {
  passwordBox: string | null;
}

const SETTING_KEY = 'mail';

let cached: EffectiveMailSettings | undefined;
let version = 0;
let undecryptableLogged = false;

function fromEnv(): EffectiveMailSettings {
  const { host, port, username, password, encryption, fromAddress, fromName } = config.mail;
  return { host, port, username, password, encryption, fromAddress, fromName, source: 'env' };
}

function fromStored(stored: StoredMailSettings): EffectiveMailSettings {
  let password = '';
  if (stored.passwordBox) {
    const opened = decryptSecret(stored.passwordBox);
    if (opened === null) {
      if (!undecryptableLogged) {
        undecryptableLogged = true;
        console.warn('[mail] stored SMTP password cannot be decrypted (key changed?); re-enter it in the admin');
      }
    } else {
      password = opened;
    }
  }
  const { host, port, username, encryption, fromAddress, fromName } = stored;
  return { host, port, username, password, encryption, fromAddress, fromName, source: 'database' };
}

export async function getEffectiveMailSettings(): Promise<EffectiveMailSettings> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  cached = row ? fromStored(JSON.parse(row.value) as StoredMailSettings) : fromEnv();
  return cached;
}

/** Bumped on every save/reset, so the mail transport knows to rebuild. */
export function mailSettingsVersion(): number {
  return version;
}

function invalidate(): void {
  cached = undefined;
  undecryptableLogged = false;
  version += 1;
}

/** Applies the password rule of {@link MailSettingsInput} against the current settings. */
export async function resolveInput(input: MailSettingsInput): Promise<MailSettings> {
  const password = input.password ?? (await getEffectiveMailSettings()).password;
  return { ...input, password };
}

export async function saveMailSettings(input: MailSettingsInput, adminId: string): Promise<EffectiveMailSettings> {
  const settings = await resolveInput(input);
  const { password, ...rest } = settings;
  const stored: StoredMailSettings = { ...rest, passwordBox: password ? encryptSecret(password) : null };
  const value = JSON.stringify(stored);

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
  invalidate();
  return getEffectiveMailSettings();
}

export async function resetMailSettings(): Promise<EffectiveMailSettings> {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEY } });
  invalidate();
  return getEffectiveMailSettings();
}

/** True when the settings would really deliver mail (never in the test suite). */
export function canDeliver(settings: MailSettings): boolean {
  return settings.host.length > 0 && config.env !== 'test';
}

export function toPublicView(settings: EffectiveMailSettings): MailSettingsView {
  const { password, source, ...rest } = settings;
  return { ...rest, passwordSet: password.length > 0, source, deliveryEnabled: canDeliver(settings) };
}

/** Display name for templates: the configured name, else the address, else a literal. */
export function brandNameOf(settings: MailSettings): string {
  return settings.fromName || settings.fromAddress || 'Ajda';
}
