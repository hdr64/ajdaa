import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';

/**
 * Symmetric encryption for secrets stored in the database (the SMTP password
 * saved from the admin). AES-256-GCM, so a tampered value fails to decrypt
 * instead of yielding garbage.
 *
 * The key comes from `SETTINGS_ENCRYPTION_KEY`, or is derived from `JWT_SECRET`
 * when that is unset. Rotating the source secret makes stored boxes unreadable;
 * `decryptSecret` then returns null and the admin re-enters the value.
 *
 * Format: `v1:<iv>:<auth tag>:<ciphertext>`, each part base64.
 */

const VERSION = 'v1';

function key(): Buffer {
  const source = config.settingsEncryptionKey || `ajda-settings:${config.jwtSecret}`;
  return createHash('sha256').update(source).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Null for anything that is not a box sealed with the current key. Never throws. */
export function decryptSecret(box: string): string | null {
  const parts = box.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
    // A fixed tag length rejects truncated tags, which GCM would otherwise accept.
    const decipher = createDecipheriv('aes-256-gcm', key(), iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
