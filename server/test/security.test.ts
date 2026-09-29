import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { loginFailureTracker } from '../src/services/loginFailureService.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  removeUser,
  SEED_ADMINS,
  SEED_PASSWORD,
  seedSession,
  sleep,
  type TestSession,
} from './helpers.js';

let cleanupUsers: string[] = [];

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  for (const id of cleanupUsers) {
    await removeUser(id);
  }
  await closeApp();
});

describe('Security & Account Protection', () => {
  describe('Login failure tracking and lockout', () => {
    it('locks out an email after 5 bad attempts (429) while another email still works', async () => {
      const targetUser = await createThrowawayUser({
        name: 'Lockout Target',
        email: 'lockout.target@ajdaa.test',
        password: 'ValidPassword123',
      });
      cleanupUsers.push(targetUser.id);

      const otherUser = await createThrowawayUser({
        name: 'Lockout Bystander',
        email: 'lockout.bystander@ajdaa.test',
        password: 'ValidPassword123',
      });
      cleanupUsers.push(otherUser.id);

      loginFailureTracker.recordSuccess(targetUser.email);
      loginFailureTracker.recordSuccess(otherUser.email);

      // 5 consecutive failed attempts on targetUser
      for (let i = 0; i < 5; i++) {
        const res = await inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: targetUser.email, password: 'WrongPassword' },
        });
        expect(res.statusCode).toBe(401);
      }

      // 6th attempt on targetUser must be locked out with 429
      const lockedRes = await inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: targetUser.email, password: 'ValidPassword123' },
      });
      expect(lockedRes.statusCode).toBe(429);
      expect(lockedRes.headers['retry-after']).toBeDefined();
      const body = lockedRes.json() as { error: string };
      expect(body.error).toContain('تم تجاوز الحد الأقصى للمحاولات');

      // Another email is unaffected and can still log in successfully
      const bystanderRes = await inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: otherUser.email, password: 'ValidPassword123' },
      });
      expect(bystanderRes.statusCode).toBe(200);
    });
  });

  describe('Spam protection (honeypot & rapid submission drop)', () => {
    it('silently drops inquiries with a non-empty honeypot (200, no row created)', async () => {
      const honeypotEmail = 'bot.inquiry@honeypot.test';

      const res = await inject({
        method: 'POST',
        url: '/api/inquiries',
        payload: {
          name: 'Spam Bot',
          email: honeypotEmail,
          interestType: 'general',
          message: 'Buy cheap watches now!',
          website: 'https://spam-domain.com',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json() as { id: string; name: string };
      expect(json.name).toBe('Spam Bot');

      const saved = await prisma.customerInquiry.findFirst({
        where: { email: honeypotEmail },
      });
      expect(saved).toBeNull();
    });

    it('silently drops newsletter subscriptions with a non-empty honeypot (200, no row created)', async () => {
      const honeypotEmail = 'bot.newsletter@honeypot.test';

      const res = await inject({
        method: 'POST',
        url: '/api/newsletter',
        payload: {
          email: honeypotEmail,
          website: 'https://evil-bot.com',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ subscribed: true });

      const saved = await prisma.newsletterSubscriber.findUnique({
        where: { email: honeypotEmail },
      });
      expect(saved).toBeNull();
    });

    it('silently drops too-fast submissions (< 2s after startedAt)', async () => {
      const fastInquiryEmail = 'too.fast.inquiry@spam.test';
      const fastNewsletterEmail = 'too.fast.news@spam.test';

      const inqRes = await inject({
        method: 'POST',
        url: '/api/inquiries',
        payload: {
          name: 'Fast Bot',
          email: fastInquiryEmail,
          interestType: 'general',
          message: 'Speedy submission',
          startedAt: Date.now(),
        },
      });

      expect(inqRes.statusCode).toBe(200);
      const savedInquiry = await prisma.customerInquiry.findFirst({
        where: { email: fastInquiryEmail },
      });
      expect(savedInquiry).toBeNull();

      const newsRes = await inject({
        method: 'POST',
        url: '/api/newsletter',
        payload: {
          email: fastNewsletterEmail,
          startedAt: Date.now(),
        },
      });

      expect(newsRes.statusCode).toBe(200);
      expect(newsRes.json()).toEqual({ subscribed: true });

      const savedNews = await prisma.newsletterSubscriber.findUnique({
        where: { email: fastNewsletterEmail },
      });
      expect(savedNews).toBeNull();
    });
  });

  describe('Profile & Password endpoints', () => {
    it('PATCH /api/auth/me updates name, email, and phone', async () => {
      const user = await createThrowawayUser({
        name: 'Original Name',
        email: 'profile.patch.test@ajdaa.test',
        password: 'Password123',
      });
      cleanupUsers.push(user.id);

      const session = await login(user.email, 'Password123');

      const updatedEmail = 'updated.profile@ajdaa.test';
      const patchRes = await authInject(session.token, {
        method: 'PATCH',
        url: '/api/auth/me',
        payload: {
          name: 'Updated Name',
          email: updatedEmail,
          phone: '0509876543',
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const body = patchRes.json() as { user: { name: string; email: string; phone: string } };
      expect(body.user.name).toBe('Updated Name');
      expect(body.user.email).toBe(updatedEmail);
      expect(body.user.phone).toBe('0509876543');

      const inDb = await prisma.adminUser.findUnique({ where: { id: user.id } });
      expect(inDb?.name).toBe('Updated Name');
      expect(inDb?.email).toBe(updatedEmail);
      expect(inDb?.phone).toBe('0509876543');
    });

    it('PATCH /api/auth/me rejects duplicate email with 409', async () => {
      const user = await createThrowawayUser({
        email: 'dup.patch.test@ajdaa.test',
        password: 'Password123',
      });
      cleanupUsers.push(user.id);

      const session = await login(user.email, 'Password123');

      const patchRes = await authInject(session.token, {
        method: 'PATCH',
        url: '/api/auth/me',
        payload: {
          email: SEED_ADMINS.superAdmin,
        },
      });

      expect(patchRes.statusCode).toBe(409);
    });

    it('POST /api/auth/me/password validates current password, enforces policy, and invalidates old tokens', async () => {
      const user = await createThrowawayUser({
        name: 'Password Target',
        email: 'pw.change.test@ajdaa.test',
        password: 'CurrentPassword123',
      });
      cleanupUsers.push(user.id);

      const session = await login(user.email, 'CurrentPassword123');

      // 1. Wrong current password -> 401
      const wrongCurrentRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/me/password',
        payload: {
          currentPassword: 'WrongCurrentPassword',
          newPassword: 'BrandNewPassword123',
        },
      });
      expect(wrongCurrentRes.statusCode).toBe(401);

      // 2. Weak new password (< 10 chars) -> 400
      const shortRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/me/password',
        payload: {
          currentPassword: 'CurrentPassword123',
          newPassword: 'Short1',
        },
      });
      expect(shortRes.statusCode).toBe(400);

      // 3. Weak new password (no digits) -> 400
      const noDigitsRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/me/password',
        payload: {
          currentPassword: 'CurrentPassword123',
          newPassword: 'OnlyLettersNoDigits',
        },
      });
      expect(noDigitsRes.statusCode).toBe(400);

      // 4. New password equals current password -> 400
      const sameRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/me/password',
        payload: {
          currentPassword: 'CurrentPassword123',
          newPassword: 'CurrentPassword123',
        },
      });
      expect(sameRes.statusCode).toBe(400);

      // Wait for next integer second so iat comparison is strictly less
      await sleep(1100);

      // 5. Successful password change
      const successRes = await authInject(session.token, {
        method: 'POST',
        url: '/api/auth/me/password',
        payload: {
          currentPassword: 'CurrentPassword123',
          newPassword: 'BrandNewPassword123',
        },
      });
      expect(successRes.statusCode).toBe(200);

      // 6. Old token must now be rejected with 401
      const oldTokenRes = await authInject(session.token, {
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(oldTokenRes.statusCode).toBe(401);

      // 7. Old password no longer works for login
      const oldLoginRes = await inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: user.email,
          password: 'CurrentPassword123',
        },
      });
      expect(oldLoginRes.statusCode).toBe(401);

      // 8. New password works for login
      const newLoginRes = await login(user.email, 'BrandNewPassword123');
      expect(newLoginRes.token).toBeDefined();

      const newMeRes = await authInject(newLoginRes.token, {
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(newMeRes.statusCode).toBe(200);
    });
  });
});
