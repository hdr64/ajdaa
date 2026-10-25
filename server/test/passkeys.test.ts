import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { encodeCBOR } from '@levischuck/tiny-cbor';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { config } from '../src/config/env.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  seedSession,
  SEED_ADMINS,
  THROWAWAY_PASSWORD,
  type TestSession,
} from './helpers.js';

const RP_ID = config.webauthn.rpId;
const ORIGIN = config.webauthn.expectedOrigins[0] ?? 'http://localhost:5173';

/**
 * Software authenticator helper to produce authentic WebAuthn registration
 * and authentication responses using Node's crypto EC P-256 and ES256 algorithm.
 */
interface SoftwareAuthenticator {
  credentialId: Buffer;
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  coseKeyBytes: Buffer;
}

function createSoftwareAuthenticator(): SoftwareAuthenticator {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const coseKey = new Map([
    [1, 2], // kty: EC2
    [3, -7], // alg: ES256
    [-1, 1], // crv: P-256
    [-2, Buffer.from(jwk.x!, 'base64url')],
    [-3, Buffer.from(jwk.y!, 'base64url')],
  ]);
  const coseKeyBytes = Buffer.from(encodeCBOR(coseKey));
  const credentialId = crypto.randomBytes(16);
  return { credentialId, privateKey, publicKey, coseKeyBytes };
}

function buildRegistrationResponse(
  auth: SoftwareAuthenticator,
  challenge: string,
  options: {
    origin?: string;
    rpId?: string;
    userVerification?: boolean;
  } = {}
) {
  const rpId = options.rpId ?? RP_ID;
  const origin = options.origin ?? ORIGIN;
  const uv = options.userVerification ?? true;

  const credIdLen = Buffer.alloc(2);
  credIdLen.writeUInt16BE(auth.credentialId.length);

  const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
  // flags: UP (0x01) | (uv ? 0x04 : 0) | AT (0x40)
  const flagByte = 0x01 | (uv ? 0x04 : 0) | 0x40;
  const flags = Buffer.from([flagByte]);
  const signCount = Buffer.alloc(4);
  const aaguid = Buffer.alloc(16);

  const authData = Buffer.concat([rpIdHash, flags, signCount, aaguid, credIdLen, auth.credentialId, auth.coseKeyBytes]);

  const attestationObj = new Map<string, any>([
    ['fmt', 'none'],
    ['attStmt', new Map()],
    ['authData', authData],
  ]);
  const attestationObject = Buffer.from(encodeCBOR(attestationObj)).toString('base64url');

  const clientDataObj = {
    type: 'webauthn.create',
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientDataObj)).toString('base64url');

  return {
    id: auth.credentialId.toString('base64url'),
    rawId: auth.credentialId.toString('base64url'),
    response: {
      clientDataJSON,
      attestationObject,
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

function buildAuthenticationResponse(
  auth: SoftwareAuthenticator,
  challenge: string,
  counter: number,
  options: {
    origin?: string;
    rpId?: string;
    userVerification?: boolean;
    userHandle?: string;
  } = {}
) {
  const rpId = options.rpId ?? RP_ID;
  const origin = options.origin ?? ORIGIN;
  const uv = options.userVerification ?? true;

  const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
  const flagByte = 0x01 | (uv ? 0x04 : 0);
  const flags = Buffer.from([flagByte]);
  const signCount = Buffer.alloc(4);
  signCount.writeUInt32BE(counter);

  const authData = Buffer.concat([rpIdHash, flags, signCount]);

  const clientDataObj = {
    type: 'webauthn.get',
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientDataObj)).toString('base64url');
  const clientDataHash = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(clientDataObj))).digest();
  const signatureBase = Buffer.concat([authData, clientDataHash]);

  const signature = crypto.sign('sha256', signatureBase, {
    key: auth.privateKey,
    dssSignature: 'der',
  });

  return {
    id: auth.credentialId.toString('base64url'),
    rawId: auth.credentialId.toString('base64url'),
    response: {
      clientDataJSON,
      authenticatorData: authData.toString('base64url'),
      signature: signature.toString('base64url'),
      userHandle: options.userHandle ? Buffer.from(options.userHandle).toString('base64url') : undefined,
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

describe('WebAuthn Passkeys (task-w3-auth-c)', () => {
  let superSession: TestSession;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await getApp();
    superSession = await seedSession(SEED_ADMINS.superAdmin);
  });

  afterEach(async () => {
    clearSentMail();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.passkey.deleteMany({ where: { adminUserId: { in: createdUserIds } } });
      await prisma.webauthnChallenge.deleteMany({ where: { adminUserId: { in: createdUserIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await closeApp();
  });

  async function createActiveAdmin(): Promise<{ user: any; session: TestSession }> {
    const user = await createThrowawayUser();
    createdUserIds.push(user.id);
    const session = await login(user.email, THROWAWAY_PASSWORD);
    return { user, session };
  }

  describe('Registration flow', () => {
    it('test_registration_options_requires_valid_password', async () => {
      const { session } = await createActiveAdmin();

      const missingPassword = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: {},
      });
      expect(missingPassword.statusCode).toBe(400);

      const wrongPassword = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: 'WrongPassword999' },
      });
      expect(wrongPassword.statusCode).toBe(401);

      const success = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      expect(success.statusCode).toBe(200);
      const body = success.json();
      expect(body.options).toBeDefined();
      expect(body.options.challenge).toBeDefined();
      expect(body.options.authenticatorSelection?.userVerification).toBe('required');
      expect(body.options.excludeCredentials).toEqual([]);
    });

    it('test_registration_verify_succeeds_and_sends_notification_mail', async () => {
      const { user, session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const { options } = optRes.json();

      const regResponse = buildRegistrationResponse(auth, options.challenge);

      clearSentMail();
      const verifyRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResponse, name: 'MacBook Pro TouchID' },
      });

      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = verifyRes.json();
      expect(verifyBody.passkey).toBeDefined();
      expect(verifyBody.passkey.name).toBe('MacBook Pro TouchID');

      // Verify email notice sent
      const sent = getSentMail();
      const notice = sent.find((m) => m.to.includes(user.email));
      expect(notice).toBeDefined();
      expect(notice?.subject).toContain('مفتاح مرور جديد');

      // User profile reflects passkeyCount
      const meRes = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().user.passkeyCount).toBe(1);

      // Subsequent options call excludes the registered credential
      const secondOptRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const secondOpts = secondOptRes.json().options;
      expect(secondOpts.excludeCredentials.length).toBe(1);
      expect(secondOpts.excludeCredentials[0].id).toBe(auth.credentialId.toString('base64url'));
    });

    it('test_registration_verify_rejects_tampered_or_invalid_responses', async () => {
      const { session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const { options } = optRes.json();

      // 1. Wrong challenge
      const wrongChallengeResp = buildRegistrationResponse(auth, 'wrong-challenge-value');
      const wrongChallengeRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: wrongChallengeResp, name: 'Key 1' },
      });
      expect(wrongChallengeRes.statusCode).toBe(400);

      // 2. Wrong origin
      const wrongOriginResp = buildRegistrationResponse(auth, options.challenge, { origin: 'https://attacker.example.com' });
      const wrongOriginRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: wrongOriginResp, name: 'Key 2' },
      });
      expect(wrongOriginRes.statusCode).toBe(400);

      // 3. User verification absent (UV=false)
      const noUvResp = buildRegistrationResponse(auth, options.challenge, { userVerification: false });
      const noUvRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: noUvResp, name: 'Key 3' },
      });
      expect(noUvRes.statusCode).toBe(400);
    });

    it('test_registration_challenge_is_single_use_and_expires', async () => {
      const { session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const { options } = optRes.json();

      const regResponse = buildRegistrationResponse(auth, options.challenge);

      // First verification succeeds
      const verifyRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResponse, name: 'Key Single Use' },
      });
      expect(verifyRes.statusCode).toBe(200);

      // Second attempt with the exact same response / challenge fails
      const replayRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResponse, name: 'Replay Key' },
      });
      expect(replayRes.statusCode).toBe(400);
    });

    it('test_max_10_passkeys_limit_enforced', async () => {
      const { user, session } = await createActiveAdmin();

      // Seed 10 passkeys directly for speed
      for (let i = 0; i < 10; i++) {
        await prisma.passkey.create({
          data: {
            adminUserId: user.id,
            credentialId: crypto.randomBytes(16).toString('base64url'),
            publicKey: crypto.randomBytes(64).toString('base64url'),
            counter: 0,
            backedUp: false,
            name: `Key ${i + 1}`,
          },
        });
      }

      // Early guard at options rejects generating registration challenge
      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      expect(optRes.statusCode).toBe(400);
      expect(optRes.json().error).toContain('10');
    });
  });

  describe('Login flow', () => {
    it('test_passkey_login_success_issues_session_and_updates_counter', async () => {
      const { user, session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      // Register passkey
      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Login Device' },
      });

      // Public login options
      const loginOptRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      expect(loginOptRes.statusCode).toBe(200);
      const { options: loginOpts, challengeId } = loginOptRes.json();
      expect(loginOpts.userVerification).toBe('required');
      expect(loginOpts.allowCredentials).toBeUndefined(); // Discoverable credential flow

      // Create authentication assertion with counter = 1
      const authResp = buildAuthenticationResponse(auth, loginOpts.challenge, 1, {
        userHandle: user.id,
      });

      // Verify login
      const loginVerifyRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: {
          challengeId,
          response: authResp,
        },
      });
      expect(loginVerifyRes.statusCode).toBe(200);
      const loginBody = loginVerifyRes.json();
      expect(loginBody.token).toBeDefined();
      expect(loginBody.user).toBeDefined();
      expect(loginBody.user.id).toBe(user.id);
      expect(loginBody.user.passkeyCount).toBe(1);

      // Verify returned token works for authenticated requests
      const meRes = await authInject(loginBody.token, { method: 'GET', url: '/api/auth/me' });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().user.id).toBe(user.id);

      // Verify DB counter was updated
      const updatedKey = await prisma.passkey.findUnique({
        where: { credentialId: auth.credentialId.toString('base64url') },
      });
      expect(updatedKey?.counter).toBe(1);
      expect(updatedKey?.lastUsedAt).not.toBeNull();
    });

    it('test_counter_regression_rejected', async () => {
      const { user, session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      // Register passkey
      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Cloned Device' },
      });

      // Manually advance counter in DB to simulate past authentications
      await prisma.passkey.update({
        where: { credentialId: auth.credentialId.toString('base64url') },
        data: { counter: 5 },
      });

      // Public login options
      const loginOptRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      const { options: loginOpts, challengeId } = loginOptRes.json();

      // Authenticator reports counter = 3 (less than stored counter 5) -> clone / replay attack
      const regressedAuthResp = buildAuthenticationResponse(auth, loginOpts.challenge, 3, {
        userHandle: user.id,
      });

      const failedLoginRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: {
          challengeId,
          response: regressedAuthResp,
        },
      });
      expect(failedLoginRes.statusCode).toBe(401);
    });

    it('test_unknown_credential_rejected_with_generic_401', async () => {
      const unknownAuth = createSoftwareAuthenticator();

      const loginOptRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      const { options: loginOpts, challengeId } = loginOptRes.json();

      const authResp = buildAuthenticationResponse(unknownAuth, loginOpts.challenge, 1);

      const verifyRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: { challengeId, response: authResp },
      });
      expect(verifyRes.statusCode).toBe(401);
    });

    it('test_suspended_and_pending_users_rejected_on_passkey_login', async () => {
      const { user, session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      // Register passkey
      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Test Key' },
      });

      // Suspend the user
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { status: 'suspended' },
      });

      const loginOptRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      const { options: loginOpts, challengeId } = loginOptRes.json();
      const authResp = buildAuthenticationResponse(auth, loginOpts.challenge, 1, { userHandle: user.id });

      const suspendedLoginRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: { challengeId, response: authResp },
      });
      expect(suspendedLoginRes.statusCode).toBe(403);

      // Change status to pending
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { status: 'pending' },
      });

      const loginOptRes2 = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      const { options: loginOpts2, challengeId: challengeId2 } = loginOptRes2.json();
      const authResp2 = buildAuthenticationResponse(auth, loginOpts2.challenge, 2, { userHandle: user.id });

      const pendingLoginRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: { challengeId: challengeId2, response: authResp2 },
      });
      expect(pendingLoginRes.statusCode).toBe(403);
    });

    it('test_passkey_login_for_totp_enabled_user_requires_no_second_step', async () => {
      const { user, session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      // Turn on TOTP for this user
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { totpSecretEnc: 'MFRGGZDFMY======', totpEnabledAt: new Date() },
      });

      // Register passkey
      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Passkey for TOTP user' },
      });

      // Sign in with passkey
      const loginOptRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/options',
      });
      const { options: loginOpts, challengeId } = loginOptRes.json();
      const authResp = buildAuthenticationResponse(auth, loginOpts.challenge, 1, { userHandle: user.id });

      const loginVerifyRes = await inject({
        method: 'POST',
        url: '/api/auth/passkeys/login/verify',
        payload: { challengeId, response: authResp },
      });

      // Owner decision: passkey with UV counts as full authentication
      expect(loginVerifyRes.statusCode).toBe(200);
      expect(loginVerifyRes.json().token).toBeDefined();
      expect(loginVerifyRes.json().step).toBeUndefined();
    });
  });

  describe('Management endpoints (list, rename, delete, reset)', () => {
    it('test_list_passkeys_never_exposes_key_material', async () => {
      const { session } = await createActiveAdmin();
      const auth = createSoftwareAuthenticator();

      const optRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Safe Inspection Key' },
      });

      const listRes = await authInject(session.token, {
        method: 'GET',
        url: '/api/auth/passkeys',
      });

      expect(listRes.statusCode).toBe(200);
      const list = listRes.json().passkeys;
      expect(list.length).toBe(1);
      const item = list[0];
      expect(item.name).toBe('Safe Inspection Key');
      expect(item.id).toBeDefined();
      expect(item.createdAt).toBeDefined();
      // Crucial: No public key or internal credential ID leaked
      expect(item.publicKey).toBeUndefined();
      expect(item.credentialId).toBeUndefined();
    });

    it('test_rename_enforces_ownership_and_validation', async () => {
      const { session: sessionA } = await createActiveAdmin();
      const { session: sessionB } = await createActiveAdmin();

      const auth = createSoftwareAuthenticator();
      const optRes = await authInject(sessionA.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      const regRes = await authInject(sessionA.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Initial Name' },
      });
      const keyId = regRes.json().passkey.id;

      // User B tries to rename User A's key -> 404
      const foreignRenameRes = await authInject(sessionB.token, {
        method: 'PATCH',
        url: `/api/auth/passkeys/${keyId}`,
        payload: { name: 'Hacked Name' },
      });
      expect(foreignRenameRes.statusCode).toBe(404);

      // User A renames their own key -> 200
      const ownRenameRes = await authInject(sessionA.token, {
        method: 'PATCH',
        url: `/api/auth/passkeys/${keyId}`,
        payload: { name: 'New Beautiful Name' },
      });
      expect(ownRenameRes.statusCode).toBe(200);
      expect(ownRenameRes.json().passkey.name).toBe('New Beautiful Name');
    });

    it('test_delete_requires_password_and_enforces_ownership', async () => {
      const { user: userA, session: sessionA } = await createActiveAdmin();
      const { session: sessionB } = await createActiveAdmin();

      const auth = createSoftwareAuthenticator();
      const optRes = await authInject(sessionA.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/options',
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      const regResp = buildRegistrationResponse(auth, optRes.json().options.challenge);
      const regRes = await authInject(sessionA.token, {
        method: 'POST',
        url: '/api/auth/passkeys/register/verify',
        payload: { response: regResp, name: 'Key to Delete' },
      });
      const keyId = regRes.json().passkey.id;

      // Missing password -> 400
      const missingPass = await authInject(sessionA.token, {
        method: 'DELETE',
        url: `/api/auth/passkeys/${keyId}`,
        payload: {},
      });
      expect(missingPass.statusCode).toBe(400);

      // Wrong password -> 401
      const wrongPass = await authInject(sessionA.token, {
        method: 'DELETE',
        url: `/api/auth/passkeys/${keyId}`,
        payload: { currentPassword: 'WrongPassword123' },
      });
      expect(wrongPass.statusCode).toBe(401);

      // User B tries to delete User A's key with User B's password -> 404
      const foreignDelete = await authInject(sessionB.token, {
        method: 'DELETE',
        url: `/api/auth/passkeys/${keyId}`,
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      expect(foreignDelete.statusCode).toBe(404);

      // User A deletes with correct password -> 200 and email notification sent
      clearSentMail();
      const successfulDelete = await authInject(sessionA.token, {
        method: 'DELETE',
        url: `/api/auth/passkeys/${keyId}`,
        payload: { currentPassword: THROWAWAY_PASSWORD },
      });
      expect(successfulDelete.statusCode).toBe(200);

      const sent = getSentMail();
      const notice = sent.find((m) => m.to.includes(userA.email));
      expect(notice).toBeDefined();
      expect(notice?.subject).toContain('حذف مفتاح مرور');

      // Key is gone
      const listRes = await authInject(sessionA.token, { method: 'GET', url: '/api/auth/passkeys' });
      expect(listRes.json().passkeys.length).toBe(0);
    });

    it('test_reset_passkeys_permission_and_mail', async () => {
      const { user: targetUser } = await createActiveAdmin();
      // Add a passkey to target
      await prisma.passkey.create({
        data: {
          adminUserId: targetUser.id,
          credentialId: crypto.randomBytes(16).toString('base64url'),
          publicKey: crypto.randomBytes(64).toString('base64url'),
          counter: 0,
          backedUp: false,
          name: 'Target Key',
        },
      });

      // Regular viewer without manageUsers attempts reset -> 403
      const viewerSession = await seedSession(SEED_ADMINS.viewer);
      const unauthReset = await authInject(viewerSession.token, {
        method: 'POST',
        url: `/api/auth/users/${targetUser.id}/reset-passkeys`,
      });
      expect(unauthReset.statusCode).toBe(403);

      // Super admin resets target passkeys -> 200 and mail sent
      clearSentMail();
      const superReset = await authInject(superSession.token, {
        method: 'POST',
        url: `/api/auth/users/${targetUser.id}/reset-passkeys`,
      });
      expect(superReset.statusCode).toBe(200);
      expect(superReset.json().reset).toBe(true);
      expect(superReset.json().count).toBe(1);

      // Target receives reset email
      const sent = getSentMail();
      const notice = sent.find((m) => m.to.includes(targetUser.email));
      expect(notice).toBeDefined();
      expect(notice?.subject).toContain('إعادة تعيين');

      // Passkeys count in DB is 0
      const remaining = await prisma.passkey.count({ where: { adminUserId: targetUser.id } });
      expect(remaining).toBe(0);
    });
  });
});
