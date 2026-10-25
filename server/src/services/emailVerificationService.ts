import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { config } from '../config/env.js';

/**
 * Single-use emailed links that prove an admin owns their address.
 *
 * Design notes (mirroring `otpService`):
 *
 * - **32 random bytes, hex-encoded.** A token a browser clicks in a link has to
 *   survive a full URL round trip, so it is high-entropy and URL-safe by
 *   construction. 256 bits from `crypto.randomBytes` need no rejection loop.
 * - **Only the hash is stored.** SHA-256 over `JWT_SECRET` and the token: a
 *   database dump alone cannot be replayed as a live link, and the pepper
 *   rotates with the secret rather than with the schema.
 * - **One token per admin + purpose.** Issuing deletes the previous row, so an
 *   older link stops working immediately — including after a resend. A given
 *   admin only ever carries one purpose (`invite` users never get `verify`
 *   tokens and vice versa), which is what lets a resend re-derive the flow.
 * - **A `purpose` column keeps the two flows separate.** The same raw string
 *   presented to the wrong endpoint produces a different row (or none), so a
 *   verify link cannot be spent on accept-invite.
 */

export const EMAIL_VERIFICATION_PURPOSES = ['invite', 'verify'] as const;
export type EmailVerificationPurpose = (typeof EMAIL_VERIFICATION_PURPOSES)[number];

const TOKEN_BYTES = 32;

/** Invite links live a week; a shorter-lived link is what the verify flow gets. */
export const EMAIL_VERIFICATION_TTL_MS: Record<EmailVerificationPurpose, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  verify: 48 * 60 * 60 * 1000,
};

export interface IssuedEmailToken {
  token: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(`${config.jwtSecret}:email_verification:${token}`, 'utf8')
    .digest('hex');
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Issues a fresh link for the admin, superseding any outstanding one. The raw
 * token is returned exactly once — only its hash is persisted.
 */
export async function issueEmailVerificationToken(
  adminUserId: string,
  purpose: EmailVerificationPurpose
): Promise<IssuedEmailToken> {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS[purpose]);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({ where: { adminUserId, purpose } });
    await tx.emailVerificationToken.create({
      data: { adminUserId, purpose, tokenHash: hashToken(token), expiresAt },
    });
  });

  return { token, expiresAt };
}

export type TokenConsumption =
  | { ok: true; adminUserId: string }
  | { ok: false };

/**
 * Spends a link. Returns `{ ok: false }` for a wrong, expired, already-used or
 * unknown token without saying which, so the endpoint can answer one identical
 * message for every failure (no account oracle).
 */
export async function consumeEmailVerificationToken(
  token: string,
  purpose: EmailVerificationPurpose
): Promise<TokenConsumption> {
  const match = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash: hashToken(token), purpose },
    select: { id: true, adminUserId: true, expiresAt: true, consumedAt: true },
  });

  if (!match || match.consumedAt !== null || match.expiresAt.getTime() <= Date.now()) {
    return { ok: false };
  }

  // `updateMany` with the same guard: a double-submit racing the click cannot
  // consume a token twice.
  const consumed = await prisma.emailVerificationToken.updateMany({
    where: { id: match.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false };

  return { ok: true, adminUserId: match.adminUserId };
}

/**
 * The purpose of the admin's most recent link, or null when none exists. Used
 * by the resend endpoint to re-issue the same flow the account was created with.
 */
export async function lastVerificationPurpose(
  adminUserId: string
): Promise<EmailVerificationPurpose | null> {
  const row = await prisma.emailVerificationToken.findFirst({
    where: { adminUserId },
    orderBy: { createdAt: 'desc' },
    select: { purpose: true, createdAt: true },
  });
  return (row?.purpose as EmailVerificationPurpose | undefined) ?? null;
}

/** Newest link row for the admin, for the resend cooldown check. */
export async function latestTokenIssuedAt(
  adminUserId: string,
  purpose: EmailVerificationPurpose
): Promise<Date | null> {
  const row = await prisma.emailVerificationToken.findFirst({
    where: { adminUserId, purpose },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
