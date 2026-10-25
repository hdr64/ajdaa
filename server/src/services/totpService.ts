import crypto from 'node:crypto';
import { config } from '../config/env.js';

/**
 * RFC 6238 TOTP (authenticator apps), implemented on `node:crypto` only.
 *
 * Design notes:
 *
 * - **No third-party library.** The algorithm is short enough to audit, and a
 *   second-factor implementation should not depend on the supply chain.
 * - **HMAC-SHA1, 6 digits, 30-second step**, as virtually every authenticator
 *   app assumes. `otpauth://` advertises the same parameters explicitly.
 * - **±1 step window.** One step of clock drift either way is tolerated; the
 *   accepted step is returned so the caller can refuse a replay.
 * - **Replay guard lives with the caller.** `verifyTotp` reports which step
 *   matched and the route compares it against the stored `totpLastStep`.
 * - **Constant-time comparisons.** Both the code check and the recovery-code
 *   check use `crypto.timingSafeEqual`, and both reject a length mismatch
 *   up-front (comparing different-length buffers throws).
 *
 * The plaintext secret is only ever returned by a setup response; everywhere
 * else it is an AES-256-GCM box produced by `secretBox`.
 */

/** RFC 4648 alphabet without padding. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_DECODE: Record<string, number> = Object.fromEntries(
  BASE32_ALPHABET.split('').map((char, index) => [char, index])
);

const SECRET_BYTES = 20; // 160 bits -> exactly 32 base32 characters
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW_STEPS = 1;
const MODULO = 10 ** DIGITS;

/** Unambiguous alphabet for recovery codes: no I/O/1/0 to survive being read aloud. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_LENGTH = 10; // two groups of five
const RECOVERY_CODES = 10;

/** Cryptographically random 20-byte secret as unpadded base32 (32 chars). */
export function generateTotpSecret(): string {
  return toBase32(crypto.randomBytes(SECRET_BYTES));
}

/** Encode bytes as unpadded RFC 4648 base32. */
function toBase32(bytes: Buffer): string {
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(buffer << (5 - bits)) & 0x1f];
  }
  return out;
}

/** Decode unpadded base32 back to bytes, or `null` when the input is not base32. */
export function decodeBase32(input: string): Buffer | null {
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length === 0) return null;

  let buffer = 0;
  let bits = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const value = BASE32_DECODE[char];
    if (value === undefined) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** The 6-digit code for a specific 30-second step. */
function codeForStep(secretBytes: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', secretBytes).update(counter).digest();
  // RFC 4226 §5.3 dynamic truncation.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % MODULO).toString().padStart(DIGITS, '0');
}

/** The code a device would show for a base32 secret at a given Unix time. Used by tests and the smoke script. */
export function totpCodeAt(secretBase32: string, unixSeconds: number): string | null {
  const secretBytes = decodeBase32(secretBase32);
  if (!secretBytes) return null;
  return codeForStep(secretBytes, Math.floor(unixSeconds / STEP_SECONDS));
}

/**
 * Verify a code against a secret within ±1 step. Returns the matched step (so
 * the caller can enforce no-replay), or `null` when nothing matched.
 * `nowMs` is injectable so the time window can be tested deterministically.
 */
export function verifyTotp(secretBase32: string, code: string, nowMs: number = Date.now()): number | null {
  // Guard the constant-time compare: it throws on different-length buffers, and
  // a non-6-digit input can never be a valid code anyway.
  if (!/^\d{6}$/.test(code)) return null;
  const secretBytes = decodeBase32(secretBase32);
  if (!secretBytes) return null;

  const currentStep = Math.floor(nowMs / 1000 / STEP_SECONDS);
  const expected = Buffer.from(code, 'utf8');
  for (let delta = -WINDOW_STEPS; delta <= WINDOW_STEPS; delta += 1) {
    const step = currentStep + delta;
    if (step < 0) continue;
    const candidate = Buffer.from(codeForStep(secretBytes, step), 'utf8');
    if (crypto.timingSafeEqual(candidate, expected)) return step;
  }
  return null;
}

/** Build the `otpauth://totp/...` payload an authenticator app scans or receives by hand. */
export function buildOtpAuthUri(secretBase32: string, issuer: string, accountName: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Group the secret in fours so it can be typed by hand from a screen. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.match(/.{1,4}/g)?.join(' ') ?? secretBase32;
}

/** Ten fresh `XXXXX-XXXXX` recovery codes. */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODES; i += 1) {
    // 10 bytes, each mapped to one alphabet character. 256 is an exact multiple
    // of the 32-character alphabet, so `% length` introduces no bias.
    const bytes = crypto.randomBytes(RECOVERY_LENGTH);
    let raw = '';
    for (const byte of bytes) {
      raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    }
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

/** Normalise a code to its bare characters so dashes, spaces and case do not matter. */
function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/** Peppered SHA-256 of a recovery code: a database dump alone cannot be replayed. */
export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${config.jwtSecret}:${normalizeRecoveryCode(code)}`, 'utf8')
    .digest('hex');
}

/** Constant-time comparison of a stored hash and a presented code. */
export function verifyRecoveryCode(storedHash: string, code: string): boolean {
  const expected = Buffer.from(hashRecoveryCode(code), 'hex');
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  if (stored.length !== expected.length || stored.length === 0) return false;
  return crypto.timingSafeEqual(stored, expected);
}
