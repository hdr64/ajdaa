import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { config } from '../config/env.js';

/**
 * One-time codes emailed to admins, for login verification and password reset.
 *
 * Design notes:
 *
 * - **Six digits from `crypto.randomInt`**, so no modulo bias and no dependency
 *   on `Math.random`.
 * - **Only the hash is stored.** The hash is SHA-256 over the code, the owning
 *   admin, the purpose and `JWT_SECRET` as a pepper: a database dump alone
 *   cannot be turned back into a usable code, and the pepper rotates with the
 *   secret rather than with the schema. Six digits are far too low-entropy for
 *   a bare hash, so the pepper is what makes an offline guess impractical.
 * - **One active challenge per admin + purpose.** Issuing a new one deletes the
 *   previous rows, so an older code (or an older `challengeId`) stops working
 *   immediately — including after a resend.
 * - **Bounded guessing.** TTL, attempt cap and resend cooldown all come from
 *   the environment so the test suite can compress them; the per-IP rate limits
 *   on the routes are the outer layer.
 */

export const OTP_PURPOSES = ['login', 'password_reset'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

const CODE_MIN = 0;
const CODE_MAX = 1_000_000;
const CODE_LENGTH = 6;

export type OtpVerification =
  | { ok: true; adminUserId: string; challengeId: string }
  /** The code was wrong but the challenge is still alive. */
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  /** Unknown, superseded, expired, consumed, or out of attempts. */
  | { ok: false; reason: 'dead' };

export type ResendResult =
  | { ok: true; adminUserId: string; challengeId: string; code: string }
  | { ok: false; reason: 'throttled'; retryAfterSeconds: number }
  | { ok: false; reason: 'dead' };

/** Cryptographically uniform 6-digit code, zero-padded so it is always 6 chars. */
export function generateOtpCode(): string {
  return crypto.randomInt(CODE_MIN, CODE_MAX).toString().padStart(CODE_LENGTH, '0');
}

function hashCode(code: string, adminUserId: string, purpose: OtpPurpose): string {
  return crypto
    .createHash('sha256')
    .update(`${config.jwtSecret}:${adminUserId}:${purpose}:${code}`, 'utf8')
    .digest('hex');
}

/** Constant-time comparison of two hex digests of the same length. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

export interface IssuedChallenge {
  challengeId: string;
  code: string;
  expiresAt: Date;
}

export async function issueChallenge(
  adminUserId: string,
  purpose: OtpPurpose
): Promise<IssuedChallenge> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + config.loginOtpTtlMs);

  const challenge = await prisma.$transaction(async (tx) => {
    // Supersede anything outstanding so exactly one challenge is ever live.
    await tx.otpChallenge.deleteMany({ where: { adminUserId, purpose } });
    return tx.otpChallenge.create({
      data: { adminUserId, purpose, codeHash: hashCode(code, adminUserId, purpose), expiresAt },
      select: { id: true },
    });
  });

  return { challengeId: challenge.id, code, expiresAt };
}

/** Invalidates every live challenge of a purpose — used when OTP is switched off. */
export async function clearChallenges(adminUserId: string, purpose: OtpPurpose): Promise<void> {
  await prisma.otpChallenge.deleteMany({ where: { adminUserId, purpose } });
}

/**
 * Owner of a live challenge, or `null`. Lets a caller apply a per-email policy
 * (such as the login lockout) *before* the challenge is replaced or consumed.
 */
export async function findChallengeOwner(
  challengeId: string,
  purpose: OtpPurpose
): Promise<{ adminUserId: string } | null> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.purpose !== purpose || isDead(challenge)) return null;
  return { adminUserId: challenge.adminUserId };
}

function isDead(challenge: { consumedAt: Date | null; expiresAt: Date; attempts: number }): boolean {
  return (
    challenge.consumedAt !== null ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.attempts >= config.loginOtpMaxAttempts
  );
}

export async function verifyChallenge(
  challengeId: string,
  code: string,
  purpose: OtpPurpose
): Promise<OtpVerification> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.purpose !== purpose || isDead(challenge)) {
    return { ok: false, reason: 'dead' };
  }

  const expected = hashCode(code, challenge.adminUserId, purpose);
  if (!digestsMatch(expected, challenge.codeHash)) {
    const attempts = challenge.attempts + 1;
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts } });
    if (attempts >= config.loginOtpMaxAttempts) {
      return { ok: false, reason: 'dead' };
    }
    return { ok: false, reason: 'invalid', attemptsLeft: config.loginOtpMaxAttempts - attempts };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, adminUserId: challenge.adminUserId, challengeId: challenge.id };
}

export async function resendChallenge(challengeId: string, purpose: OtpPurpose): Promise<ResendResult> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.purpose !== purpose || isDead(challenge)) {
    return { ok: false, reason: 'dead' };
  }

  const elapsedMs = Date.now() - challenge.createdAt.getTime();
  if (elapsedMs < config.loginOtpResendCooldownMs) {
    return {
      ok: false,
      reason: 'throttled',
      retryAfterSeconds: Math.max(1, Math.ceil((config.loginOtpResendCooldownMs - elapsedMs) / 1000)),
    };
  }

  const issued = await issueChallenge(challenge.adminUserId, purpose);
  return { ok: true, adminUserId: challenge.adminUserId, challengeId: issued.challengeId, code: issued.code };
}

/** Expiry in whole minutes, for the wording of the email. */
export function ttlMinutes(): number {
  return Math.max(1, Math.round(config.loginOtpTtlMs / 60_000));
}
