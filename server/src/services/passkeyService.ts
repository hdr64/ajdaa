import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from './prisma.js';
import { config } from '../config/env.js';
import { loggerService } from './loggerService.js';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_PASSKEYS_PER_USER = 10;

/** Opportunistically purge expired challenges without failing the caller. */
async function purgeExpiredChallenges(): Promise<void> {
  try {
    await prisma.webauthnChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Non-blocking cleanup
  }
}

export async function createRegistrationOptions(user: { id: string; email: string; name: string }) {
  await purgeExpiredChallenges();

  const existingPasskeys = await prisma.passkey.findMany({
    where: { adminUserId: user.id },
    select: { credentialId: true, transports: true },
  });

  if (existingPasskeys.length >= MAX_PASSKEYS_PER_USER) {
    throw new Error(`Maximum of ${MAX_PASSKEYS_PER_USER} passkeys reached`);
  }

  // Convert user.id string to Uint8Array for WebAuthn user handle
  const userID = new Uint8Array(Buffer.from(user.id, 'utf8'));

  const options = await generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: config.webauthn.rpId,
    userName: user.email,
    userDisplayName: user.name,
    userID,
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports ? JSON.parse(p.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  // Store DB-backed challenge for registration
  await prisma.webauthnChallenge.create({
    data: {
      kind: 'register',
      adminUserId: user.id,
      challenge: options.challenge,
      expiresAt,
    },
  });

  return options;
}

export async function verifyAndSaveRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  name?: string
) {
  await purgeExpiredChallenges();

  // Find and consume the latest live challenge for this user
  const challengeRow = await prisma.webauthnChallenge.findFirst({
    where: {
      kind: 'register',
      adminUserId: userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challengeRow) {
    throw new Error('WebAuthn registration challenge not found or expired');
  }

  // Single-use: delete immediately
  await prisma.webauthnChallenge.delete({
    where: { id: challengeRow.id },
  });

  const passkeyCount = await prisma.passkey.count({
    where: { adminUserId: userId },
  });

  if (passkeyCount >= MAX_PASSKEYS_PER_USER) {
    throw new Error(`Maximum of ${MAX_PASSKEYS_PER_USER} passkeys reached`);
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: config.webauthn.expectedOrigins,
    expectedRPID: config.webauthn.rpId,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // Extract transports safely if reported in response
  const rawTransports = (response.response as { transports?: string[] }).transports;
  const transports = Array.isArray(rawTransports) ? JSON.stringify(rawTransports) : null;

  const userLabel = (name?.trim() || `مفتاحي (${new Date().toLocaleDateString('ar-SA')})`).slice(0, 60);

  const passkey = await prisma.passkey.create({
    data: {
      adminUserId: userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: userLabel,
    },
  });

  return passkey;
}

export async function createLoginOptions() {
  await purgeExpiredChallenges();

  const options = await generateAuthenticationOptions({
    rpID: config.webauthn.rpId,
    userVerification: 'required',
    // Discoverable credential flow: no allowCredentials restriction
  });

  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const challengeRecord = await prisma.webauthnChallenge.create({
    data: {
      kind: 'login',
      challenge: options.challenge,
      expiresAt,
    },
  });

  return {
    options,
    challengeId: challengeRecord.id,
  };
}

export async function verifyLogin(challengeId: string, response: AuthenticationResponseJSON) {
  await purgeExpiredChallenges();

  const challengeRow = await prisma.webauthnChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challengeRow || challengeRow.kind !== 'login') {
    throw new Error('Invalid or expired login challenge');
  }

  // Delete challenge immediately to enforce single-use
  await prisma.webauthnChallenge.delete({
    where: { id: challengeId },
  });

  if (challengeRow.expiresAt.getTime() < Date.now()) {
    throw new Error('Login challenge expired');
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { adminUser: true },
  });

  if (!passkey) {
    throw new Error('Unknown passkey credential');
  }

  const user = passkey.adminUser;

  // Status checks: suspended / pending admins cannot sign in
  if (user.status === 'suspended') {
    const error = new Error('الحساب معطل. تواصل مع مدير النظام.');
    (error as unknown as { statusCode: number }).statusCode = 403;
    throw error;
  }

  if (user.status === 'pending') {
    const error = new Error('يرجى تأكيد البريد الإلكتروني أولاً قبل تسجيل الدخول.');
    (error as unknown as { statusCode: number }).statusCode = 403;
    throw error;
  }

  const transports = passkey.transports ? JSON.parse(passkey.transports) : undefined;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: config.webauthn.expectedOrigins,
    expectedRPID: config.webauthn.rpId,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.counter,
      transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error('Passkey authentication verification failed');
  }

  const { newCounter } = verification.authenticationInfo;

  // Counter regression check: if credential reports counters and counter did not advance
  if (passkey.counter > 0 && newCounter <= passkey.counter) {
    loggerService.warn('Passkey counter regression detected - possible cloned authenticator', {
      passkeyId: passkey.id,
      adminUserId: user.id,
      currentCounter: passkey.counter,
      newCounter,
    });
    throw new Error('Passkey counter regression detected');
  }

  // Update passkey counter and lastUsedAt
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: newCounter,
      lastUsedAt: new Date(),
    },
  });

  return user;
}
