import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { buildCsv, sendCsv } from '../services/csv.js';
import { config } from '../config/env.js';
import { parsePreferences, preferencesSchema } from '../config/preferences.js';
import { loginOtpRequiredForAll } from '../services/securitySettings.js';
import { loginFailureTracker } from '../services/loginFailureService.js';
import { loggerService } from '../services/loggerService.js';
import { mailBrandName, isMailEnabled, sendMail } from '../services/mailService.js';
import { emailVerificationEmail, loginOtpEmail, passwordResetEmail } from '../services/mailTemplates.js';
import { notifyPasswordChanged } from '../services/notificationService.js';
import { dispatch } from '../services/queueService.js';
import { sendInviteEmailJob, sendEmailVerificationJob, sendPasswordChangeCodeJob } from '../jobs/emailJobs.js';
import {
  consumeEmailVerificationToken,
  issueEmailVerificationToken,
  lastVerificationPurpose,
  latestTokenIssuedAt,
  EMAIL_VERIFICATION_TTL_MS,
  type EmailVerificationPurpose,
} from '../services/emailVerificationService.js';
import {
  clearChallenges,
  findChallengeOwner,
  findLiveChallenge,
  issueChallenge,
  resendChallenge,
  ttlMinutes,
  verifyChallenge,
} from '../services/otpService.js';
import { meetsPasswordPolicy, PASSWORD_POLICY_ERROR } from '../services/passwordPolicy.js';
import {
  parsePermissions,
  parseRolePermissions,
  rolePermissionsToUserPermissions,
} from '../config/permissions.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  challengeId: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const resendOtpSchema = z.object({
  challengeId: z.string().trim().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
  newPassword: z.string().min(1, 'New password is required'),
});

const loginOtpSettingsSchema = z.object({
  enabled: z.boolean(),
  password: z.string().min(1, 'Current password is required'),
});

const OTP_EXPIRED_ERROR = 'رمز التحقق منتهي الصلاحية أو تم استخدامه، يرجى طلب رمز جديد / Verification code has expired or was already used, please request a new one';
const OTP_INVALID_ERROR = 'رمز التحقق غير صحيح / Invalid verification code';
const RESET_FAILED_ERROR = 'تعذّر إكمال إعادة التعيين: رمز غير صحيح أو منتهي الصلاحية / Could not reset the password: the code is invalid or has expired';
const MAIL_UNAVAILABLE_ERROR =
  'تعذّر إرسال رسالة البريد الإلكتروني، حاول بعد قليل / Could not send the verification email, please try again shortly';

const EMAIL_NOT_VERIFIED_ERROR =
  'لم يتم تأكيد بريدك الإلكتروني بعد / Your email address has not been verified yet';
const EMAIL_VERIFICATION_FAILED_ERROR =
  'رابط التحقق غير صالح أو منتهي الصلاحية / The verification link is invalid or has expired';
const INVITE_FAILED_ERROR = 'رابط الدعوة غير صالح أو منتهي الصلاحية / The invite link is invalid or has expired';
const CODE_REQUIRED_ERROR = 'رمز تأكيد تغيير كلمة المرور مطلوب / A password-change confirmation code is required';
const SUPER_ADMIN_PASSWORD_REQUIRED_ERROR =
  'يحصل المدير العام على كلمة مرور يحددها المسؤول ولا يمكن دعوته / A super admin is created with an admin-set password and cannot be invited';
const INVITE_PASSWORD_FORBIDDEN_ERROR =
  'لا تُحدَّد كلمة مرور للمستخدم المدعو، فهو يختارها بنفسه / An invited user chooses their own password, so none may be set here';
const EMAIL_ALREADY_VERIFIED_ERROR = 'تم تأكيد بريد هذا الحساب بالفعل / This account email is already verified';
const PENDING_ACTIVATION_ERROR =
  'لا يمكن تنشيط حساب لم يُؤكَّد بريده الإلكتروني بعد / An account with an unverified email cannot be activated';
const RESEND_TOO_SOON_ERROR = 'يرجى الانتظار قبل إعادة إرسال الرابط / Please wait before requesting a new link';
const SEND_PASSWORD_INVITE_ERROR =
  'لا تُرسل كلمة مرور مع دعوة، يختار المستخدم كلمة مروره عبر الرابط / Do not send a password with an invite; the user chooses their own password';
const MARK_VERIFIED_NOT_FOUND = 'المستخدم غير موجود / User not found';
const MARK_VERIFIED_ALREADY_VERIFIED = 'بريد هذا الحساب مؤكد بالفعل / This account email is already verified';
const MARK_VERIFIED_SUPER_ADMIN_TARGET = 'لا يمكن تأكيد حساب مدير عام من غير مدير عام / Only a super admin can verify a super admin account';


const RATE_LIMIT_ERROR_BODY = {
  statusCode: 429,
  error: 'Too Many Requests',
  message: 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً / Rate limit exceeded, please try again later',
} as const;

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
  // Required for a non-super-admin (the emailed confirmation step); a super
  // admin keeps the one-step call and omits both.
  challengeId: z.string().trim().min(1).optional(),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits').optional(),
});

const requestPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required'),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const resendVerificationCodeSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required'),
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  // 'create' keeps today's flow (admin sets a password, account starts pending);
  // 'invite' emails a link where the user picks their own password.
  mode: z.enum(['create', 'invite']).default('create'),
  // No default: an account is never created with a password nobody chose.
  // The policy itself is checked in the handler.
  password: z.string().min(8).optional(),
  phone: z.string().trim().nullish(),
  role: z.string().optional(),
  roleId: z.string().optional(),
  roleAr: z.string().optional(),
  department: z.string().nullish(),
  departmentId: z.string().nullish(),
  permissions: z.record(z.boolean()).optional(),
  // Create mode only: the admin-typed password is emailed in a separated block
  // and never written to the queue or any log. Rejected with `invite`.
  sendPasswordInEmail: z.boolean().optional().default(false),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    phone: z.string().trim().nullish(),
    role: z.string().optional(),
    roleId: z.string().nullish(),
    roleAr: z.string().optional(),
    department: z.string().nullish(),
    departmentId: z.string().nullish(),
    permissions: z.record(z.boolean()).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const userIdParamsSchema = z.object({ id: z.string().min(1) });

type UpdateUserInput = z.infer<typeof updateUserSchema>;

interface OtpUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** True when this admin must clear a one-time code before a session is issued. */
async function requiresLoginOtp(user: { loginOtpEnabled: boolean }): Promise<boolean> {
  return user.loginOtpEnabled || (await loginOtpRequiredForAll());
}

/**
 * `ajdaa.sa` → `aj***@ajdaa.sa`. Enough for the user to recognise the account
 * without echoing the full address back over an unauthenticated endpoint.
 */
function emailHint(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

async function sendLoginOtpMail(user: OtpUser, code: string): Promise<void> {
  const content = loginOtpEmail({
    brandName: await mailBrandName(),
    name: user.name,
    code,
    expiresInMinutes: ttlMinutes(),
  });
  await sendMail({ to: user.email, ...content });
}

async function sendPasswordResetMail(user: OtpUser, code: string): Promise<void> {
  const content = passwordResetEmail({
    brandName: await mailBrandName(),
    name: user.name,
    code,
    expiresInMinutes: ttlMinutes(),
  });
  await sendMail({ to: user.email, ...content });
}

async function findActiveUser(id: string): Promise<OtpUser | null> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user || user.status !== 'active') return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

const VERIFICATION_MAIL_JOB = {
  invite: sendInviteEmailJob,
  verify: sendEmailVerificationJob,
} as const;

/**
 * Issues a fresh verification link for the account and queues the matching mail.
 *
 * Mail never blocks account creation: the job runs through the queue (so a dead
 * server is retried), and the returned flag reflects whether SMTP is configured
 * at all — `false` is the UI's cue to offer "resend". In the in-memory transport
 * the job still records the message for the tests to assert on.
 */
async function sendAccountVerificationMail(
  user: { id: string; email: string; name: string },
  purpose: EmailVerificationPurpose,
  options: { password?: string } = {}
): Promise<boolean> {
  const { token } = await issueEmailVerificationToken(user.id, purpose);
  let code: string | undefined;
  let codeExpiresInMinutes: number | undefined;

  if (purpose === 'verify') {
    const issued = await issueChallenge(user.id, 'email_verification');
    code = issued.code;
    codeExpiresInMinutes = ttlMinutes();
  }

  const mailSent = await isMailEnabled();

  // A typed password must never reach the queue (Redis in production), so this
  // one mail is rendered and sent directly. A transport failure must not fail
  // account creation: the caller turns it into `mailSent = false`.
  if (options.password !== undefined) {
    const content = emailVerificationEmail({
      brandName: await mailBrandName(),
      name: user.name,
      verifyUrl: `${config.appUrl}/admin/verify-email?token=${encodeURIComponent(token)}`,
      expiresInHours: Math.round(EMAIL_VERIFICATION_TTL_MS.verify / (60 * 60 * 1000)),
      code,
      codeExpiresInMinutes,
      password: options.password,
    });
    try {
      await sendMail({ to: user.email, ...content });
    } catch {
      return false;
    }
    return mailSent;
  }

  const jobPayload: {
    to: string;
    name?: string | null;
    token: string;
    code?: string | null;
    codeExpiresInMinutes?: number;
  } = { to: user.email, name: user.name, token };
  if (purpose === 'verify') {
    jobPayload.code = code ?? null;
    jobPayload.codeExpiresInMinutes = codeExpiresInMinutes;
  }
  await dispatch(VERIFICATION_MAIL_JOB[purpose], jobPayload);
  return mailSent;
}

/** A bcrypt hash of a value nobody knows: an invited account has no usable password. */
async function hashUnusablePassword(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
}

/**
 * The per-email lockout applies to the whole login flow: a correct password plus
 * a valid code must not be a way around it. Answers `429` and returns `true`
 * when the caller should stop.
 */
function rejectIfLocked(email: string, reply: FastifyReply): boolean {
  const lockout = loginFailureTracker.isLocked(email);
  if (!lockout.locked) return false;

  reply.header('Retry-After', lockout.retryAfter.toString());
  reply.status(429).send({
    error: 'تم تجاوز الحد الأقصى للمحاولات غير الصحيحة، يرجى المحاولة لاحقاً / Too many failed login attempts, please try again later',
  });
  return true;
}

const PASSWORD_LOCKOUT_ERROR =
  'تم تجاوز الحد الأقصى للمحاولات غير الصحيحة، يرجى المحاولة لاحقاً / Too many failed attempts, please try again later';

/** The self-service password lockout, shared by the request and confirm steps. */
function rejectPasswordChangeLockout(email: string, reply: FastifyReply): boolean {
  const lockout = loginFailureTracker.isLocked(email);
  if (!lockout.locked) return false;
  reply.header('Retry-After', lockout.retryAfter.toString());
  reply.status(429).send({ error: PASSWORD_LOCKOUT_ERROR });
  return true;
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  roleAr: string;
  roleId?: string | null;
  department: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: string;
  status: string;
  lastLogin: string | null;
  departmentRef?: { nameAr: string } | null;
  loginOtpEnabled?: boolean | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    roleAr: user.roleAr,
    roleId: user.roleId ?? null,
    department: user.department,
    departmentId: user.departmentId ?? null,
    departmentName: user.departmentName ?? user.departmentRef?.nameAr ?? user.department ?? null,
    permissions: parsePermissions(user.permissions),
    status: user.status,
    lastLogin: user.lastLogin,
    loginOtpEnabled: Boolean(user.loginOtpEnabled),
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: config.rateLimitLoginMax,
          timeWindow: config.rateLimitLoginWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(loginSchema)],
    },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body ?? {});
      const normalizedEmail = email.toLowerCase().trim();

      if (rejectIfLocked(normalizedEmail, reply)) return reply;

      const user = await prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      if (user.status === 'suspended') {
        return reply.status(403).send({ error: 'Account is suspended' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // The password is proven, so the failure counter is cleared. A wrong code
      // is *not* fed back into this tracker: the challenge's own attempt cap
      // bounds guessing, and charging it here would let anyone holding a stolen
      // password lock the real owner out for the whole window.
      loginFailureTracker.recordSuccess(normalizedEmail);

      // Only reached once the password is proven, so 503/403 here is never an
      // oracle for a wrong password. A create-mode `pending` account has a real
      // password and is told to verify; an invite account has an unusable one
      // and already failed the bcrypt check above with a plain 401.
      if (user.status === 'pending') {
        return reply.status(403).send({ error: EMAIL_NOT_VERIFIED_ERROR, code: 'EMAIL_NOT_VERIFIED' });
      }

      if (await requiresLoginOtp(user)) {
        const { challengeId, code } = await issueChallenge(user.id, 'login');
        // The password is already proven here, so a dead SMTP server can be
        // reported honestly instead of pretending a code was sent.
        try {
          await sendLoginOtpMail(user, code);
        } catch {
          return reply.status(503).send({ error: MAIL_UNAVAILABLE_ERROR });
        }

        return reply.status(200).send({
          otpRequired: true,
          challengeId,
          emailHint: emailHint(user.email),
        });
      }

      await prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLogin: new Date().toISOString() },
      });

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: serializeUser(user),
      };
    }
  );

  // Complete an OTP login (Public)
  fastify.post(
    '/login/verify-otp',
    {
      config: {
        rateLimit: {
          max: config.rateLimitOtpMax,
          timeWindow: config.rateLimitOtpWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(verifyOtpSchema)],
    },
    async (request, reply) => {
      const { challengeId, code } = verifyOtpSchema.parse(request.body ?? {});

      // The challenge is inspected before it is consumed: while the account is
      // locked the code is neither spent nor counted as an attempt, and a
      // suspended owner is told the same thing as an unknown challenge. Only then
      // does the code itself get verified.
      const owner = await findChallengeOwner(challengeId, 'login');
      if (!owner) return reply.status(410).send({ error: OTP_EXPIRED_ERROR });

      const lockedUser = await findActiveUser(owner.adminUserId);
      if (!lockedUser) return reply.status(410).send({ error: OTP_EXPIRED_ERROR });
      if (rejectIfLocked(lockedUser.email, reply)) return reply;

      const result = await verifyChallenge(challengeId, code, 'login');
      if (!result.ok) {
        if (result.reason === 'dead') {
          return reply.status(410).send({ error: OTP_EXPIRED_ERROR });
        }
        return reply.status(400).send({ error: OTP_INVALID_ERROR, attemptsLeft: result.attemptsLeft });
      }

      const user = await prisma.adminUser.findUnique({ where: { id: result.adminUserId } });
      if (!user || user.status !== 'active') {
        return reply.status(410).send({ error: OTP_EXPIRED_ERROR });
      }

      await prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLogin: new Date().toISOString() },
      });

      return {
        token: fastify.jwt.sign({ id: user.id, email: user.email, role: user.role }),
        user: serializeUser(user),
      };
    }
  );

  // Re-send the login code (Public)
  fastify.post(
    '/login/resend-otp',
    {
      config: {
        rateLimit: {
          max: config.rateLimitOtpMax,
          timeWindow: config.rateLimitOtpWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(resendOtpSchema)],
    },
    async (request, reply) => {
      const { challengeId } = resendOtpSchema.parse(request.body ?? {});

      // Resolved before the challenge is replaced, so the per-email lockout is
      // checked against the address that owns it.
      const owner = await findChallengeOwner(challengeId, 'login');
      if (!owner) return reply.status(410).send({ error: OTP_EXPIRED_ERROR });

      const user = await findActiveUser(owner.adminUserId);
      if (!user) return reply.status(410).send({ error: OTP_EXPIRED_ERROR });
      if (rejectIfLocked(user.email, reply)) return reply;

      const result = await resendChallenge(challengeId, 'login');
      if (!result.ok) {
        if (result.reason === 'throttled') {
          reply.header('Retry-After', result.retryAfterSeconds.toString());
          return reply.status(429).send({
            error: 'يرجى الانتظار قبل طلب رمز جديد / Please wait before requesting a new code',
          });
        }
        return reply.status(410).send({ error: OTP_EXPIRED_ERROR });
      }

      // The new code belongs to a challenge that superseded the old one, so the
      // previous `challengeId` (and its code) stop working from here on.
      try {
        await sendLoginOtpMail(user, result.code);
      } catch {
        return reply.status(503).send({ error: MAIL_UNAVAILABLE_ERROR });
      }

      return { sent: true };
    }
  );

  // Start a password reset (Public). Always answers 200 so the endpoint cannot be
  // used to discover which email addresses have an account.
  fastify.post(
    '/password/forgot',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(forgotPasswordSchema)],
    },
    async (request) => {
      const { email } = forgotPasswordSchema.parse(request.body ?? {});
      const user = await prisma.adminUser.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user && user.status === 'active') {
        const { code } = await issueChallenge(user.id, 'password_reset');
        try {
          await sendPasswordResetMail(user, code);
        } catch {
          // The endpoint always answers 200 so it cannot be used to discover
          // which addresses have an account. A dead SMTP server must not turn
          // that into an oracle, so the failure stays invisible here (the
          // mail service has already logged it).
        }
      }

      return { sent: true };
    }
  );

  // Finish a password reset (Public)
  fastify.post(
    '/password/reset',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(resetPasswordSchema)],
    },
    async (request, reply) => {
      const { email, code, newPassword } = resetPasswordSchema.parse(request.body ?? {});
      const normalizedEmail = email.toLowerCase();

      const user = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
      if (!user || user.status !== 'active') {
        return reply.status(400).send({ error: RESET_FAILED_ERROR });
      }

      // Checked before the challenge is touched: a password that fails the policy
      // must not burn the user's only code.
      if (!meetsPasswordPolicy(newPassword)) {
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      const challenge = await prisma.otpChallenge.findFirst({
        where: { adminUserId: user.id, purpose: 'password_reset' },
        orderBy: { createdAt: 'desc' },
      });
      if (!challenge) {
        return reply.status(400).send({ error: RESET_FAILED_ERROR });
      }

      const result = await verifyChallenge(challenge.id, code, 'password_reset');
      if (!result.ok) {
        return reply.status(400).send({ error: RESET_FAILED_ERROR });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      // Moving passwordChangedAt forward is what kills every token issued before
      // this point, including the one the browser is currently holding.
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });

      loginFailureTracker.recordSuccess(normalizedEmail);

      void notifyPasswordChanged({ email: user.email, name: user.name, via: 'reset' });

      return { reset: true };
    }
  );

  // Confirm a create-mode account's email (Public). Every failure answers the
  // same 400 so the endpoint cannot be used to learn which links are live.
  fastify.post(
    '/verify-email',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(verifyEmailSchema)],
    },
    async (request, reply) => {
      const { token } = verifyEmailSchema.parse(request.body ?? {});

      const consumed = await consumeEmailVerificationToken(token, 'verify');
      if (!consumed.ok) {
        return reply.status(400).send({ error: EMAIL_VERIFICATION_FAILED_ERROR });
      }

      // The cascade deletes tokens with the account, so a live token always has
      // an owner; the null check is the unreachable boundary guard.
      const user = await prisma.adminUser.findUnique({ where: { id: consumed.adminUserId } });
      if (!user) {
        return reply.status(400).send({ error: EMAIL_VERIFICATION_FAILED_ERROR });
      }

      await prisma.adminUser.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), status: 'active' },
      });

      return { verified: true };
    }
  );

  // Confirm a create-mode account's email with the 6-digit code (Public). The
  // account must exist, be pending, unverified and hold a real password; invite
  // accounts have an unusable password and fail the bcrypt check above, which
  // is the correct (no-oracle) outcome.
  fastify.post(
    '/verify-email-code',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(verifyEmailCodeSchema)],
    },
    async (request, reply) => {
      const { email, password, code } = verifyEmailCodeSchema.parse(request.body ?? {});
      const normalizedEmail = email.toLowerCase().trim();

      if (rejectIfLocked(normalizedEmail, reply)) return reply;

      const user = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        // No account oracle: a missing address answers the same as a wrong one.
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      // The password is proven, so clear any earlier failures. A wrong code is
      // bounded by the challenge's own attempt cap, not this tracker.
      loginFailureTracker.recordSuccess(normalizedEmail);

      // Only a pending, unverified create-mode account can use the code. An
      // already-verified or active account answers like a generic failure.
      if (user.status !== 'pending' || user.emailVerifiedAt !== null) {
        return reply.status(400).send({ error: EMAIL_VERIFICATION_FAILED_ERROR });
      }

      const challenge = await findLiveChallenge(user.id, 'email_verification');
      if (!challenge) {
        return reply.status(400).send({ error: OTP_EXPIRED_ERROR });
      }

      const result = await verifyChallenge(challenge.id, code, 'email_verification');
      if (!result.ok) {
        if (result.reason === 'dead') {
          return reply.status(400).send({ error: OTP_EXPIRED_ERROR });
        }
        return reply.status(400).send({ error: OTP_INVALID_ERROR, attemptsLeft: result.attemptsLeft });
      }

      // The code is consumed by verifyChallenge above. Kill the verify link and
      // any other email_verification challenge so neither can be replayed.
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), status: 'active' },
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { adminUserId: user.id, purpose: 'verify' },
      });
      await clearChallenges(user.id, 'email_verification');

      return { verified: true };
    }
  );

  // Re-send the email verification code (and a fresh link) for a pending
  // create-mode account (Public). Same credential checks as verify-email-code,
  // then the existing resend cooldown.
  fastify.post(
    '/verify-email-code/resend',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(resendVerificationCodeSchema)],
    },
    async (request, reply) => {
      const { email, password } = resendVerificationCodeSchema.parse(request.body ?? {});
      const normalizedEmail = email.toLowerCase().trim();

      if (rejectIfLocked(normalizedEmail, reply)) return reply;

      const user = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      loginFailureTracker.recordSuccess(normalizedEmail);

      if (user.status !== 'pending' || user.emailVerifiedAt !== null) {
        return reply.status(400).send({ error: EMAIL_VERIFICATION_FAILED_ERROR });
      }

      // Cooldown on the newest of the verify link and the email_verification
      // challenge; re-issuing supersedes both.
      const issuedAt = await latestTokenIssuedAt(user.id, 'verify');
      const challenge = await prisma.otpChallenge.findFirst({
        where: { adminUserId: user.id, purpose: 'email_verification' },
        orderBy: { createdAt: 'desc' },
      });
      const newest =
        issuedAt && challenge
          ? new Date(Math.max(issuedAt.getTime(), challenge.createdAt.getTime()))
          : issuedAt ?? challenge?.createdAt ?? null;
      if (newest) {
        const elapsedMs = Date.now() - newest.getTime();
        if (elapsedMs < config.loginOtpResendCooldownMs) {
          reply.header(
            'Retry-After',
            Math.max(1, Math.ceil((config.loginOtpResendCooldownMs - elapsedMs) / 1000)).toString()
          );
          return reply.status(429).send({ error: RESEND_TOO_SOON_ERROR });
        }
      }

      await sendAccountVerificationMail({ id: user.id, email: user.email, name: user.name }, 'verify');
      return { sent: true };
    }
  );

  // Accept an invite: verify the address and set the first password (Public).
  fastify.post(
    '/accept-invite',
    {
      config: {
        rateLimit: {
          max: config.rateLimitPasswordResetMax,
          timeWindow: config.rateLimitPasswordResetWindowMs,
          errorResponseBuilder: () => RATE_LIMIT_ERROR_BODY,
        },
      },
      preValidation: [validateBody(acceptInviteSchema)],
    },
    async (request, reply) => {
      const { token, password } = acceptInviteSchema.parse(request.body ?? {});

      // The policy is checked before the token is touched: a weak password must
      // not burn the recipient's only invite link.
      if (!meetsPasswordPolicy(password)) {
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      const consumed = await consumeEmailVerificationToken(token, 'invite');
      if (!consumed.ok) {
        return reply.status(400).send({ error: INVITE_FAILED_ERROR });
      }

      const user = await prisma.adminUser.findUnique({ where: { id: consumed.adminUserId } });
      if (!user) {
        return reply.status(400).send({ error: INVITE_FAILED_ERROR });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date(), emailVerifiedAt: new Date(), status: 'active' },
      });

      // No session is minted here: the UI sends the new admin to the login page.
      return { activated: true };
    }
  );

  // Get current user profile
  fastify.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user: serializeUser(user) };
  });

  // Update own profile
  fastify.patch(
    '/me',
    { onRequest: [authenticate], preValidation: [validateBody(updateProfileSchema)] },
    async (request, reply) => {
      const data = updateProfileSchema.parse(request.body ?? {});

      if (data.email) {
        const existing = await prisma.adminUser.findUnique({
          where: { email: data.email },
        });
        if (existing && existing.id !== request.user.id) {
          return reply.status(409).send({ error: 'Email already in use' });
        }
      }

      const updateData: { name?: string; email?: string; phone?: string | null } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone || null;

      const updated = await prisma.adminUser.update({
        where: { id: request.user.id },
        data: updateData,
        include: { departmentRef: true, roleRef: true },
      });

      return reply.status(200).send({ user: serializeUser(updated) });
    }
  );

  // Start a self-service password change (step 1). Validates the current
  // password and the policy, then emails a single-use code. The new password is
  // never stored here — only the code's hash is — so a lost step cannot set it.
  fastify.post(
    '/me/password/request',
    { onRequest: [authenticate], preValidation: [validateBody(requestPasswordChangeSchema)] },
    async (request, reply) => {
      const { currentPassword, newPassword } = requestPasswordChangeSchema.parse(request.body ?? {});

      const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (rejectPasswordChangeLockout(user.email, reply)) return reply;

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(user.email);
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      if (!meetsPasswordPolicy(newPassword, currentPassword)) {
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      loginFailureTracker.recordSuccess(user.email);

      const { challengeId, code } = await issueChallenge(user.id, 'password_change');
      await dispatch(sendPasswordChangeCodeJob, { to: user.email, name: user.name, code });

      return { challengeId, emailHint: emailHint(user.email) };
    }
  );

  // Change password. A super admin does this in one step; every other account
  // must first obtain a code via `/me/password/request` and present it here.
  fastify.post(
    '/me/password',
    { onRequest: [authenticate], preValidation: [validateBody(changePasswordSchema)] },
    async (request, reply) => {
      const { currentPassword, newPassword, challengeId, code } = changePasswordSchema.parse(request.body ?? {});

      const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const requiresCode = user.role !== 'super_admin';
      if (requiresCode && (!challengeId || !code)) {
        return reply.status(400).send({ error: CODE_REQUIRED_ERROR, code: 'CODE_REQUIRED' });
      }

      if (rejectPasswordChangeLockout(user.email, reply)) return reply;

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(user.email);
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      if (!meetsPasswordPolicy(newPassword, currentPassword)) {
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      // Verified last, after every other check: a wrong current password or a
      // weak new one must not spend the emailed code.
      if (requiresCode) {
        const verdict = await verifyChallenge(challengeId!, code!, 'password_change');
        if (!verdict.ok) {
          if (verdict.reason === 'invalid') {
            return reply.status(400).send({ error: OTP_INVALID_ERROR, attemptsLeft: verdict.attemptsLeft });
          }
          return reply.status(400).send({ error: OTP_EXPIRED_ERROR });
        }
        // The challenge must belong to the caller: a guessed or borrowed id is
        // treated exactly like a dead one, so it never becomes an oracle.
        if (verdict.adminUserId !== user.id) {
          return reply.status(400).send({ error: OTP_EXPIRED_ERROR });
        }
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const passwordChangedAt = new Date();

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt,
        },
      });

      loginFailureTracker.recordSuccess(user.email);

      void notifyPasswordChanged({ email: user.email, name: user.name, via: 'self_service' });

      // The change revokes every token issued before it, including the caller's;
      // hand this session a fresh one so the admin is not signed out mid-page.
      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return reply.status(200).send({ message: 'Password updated successfully', token });
    }
  );

  // UI preferences of the signed-in admin (e.g. "don't ask again" choices)
  fastify.get('/me/preferences', { onRequest: [authenticate] }, async (request, reply) => {
    const user = await prisma.adminUser.findUnique({ where: { id: request.user.id }, select: { preferences: true } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return parsePreferences(user.preferences);
  });

  fastify.put(
    '/me/preferences',
    { onRequest: [authenticate], preValidation: [validateBody(preferencesSchema)] },
    async (request) => {
      const parsed = preferencesSchema.parse(request.body);
      const preferences = { skipConfirm: [...new Set(parsed.skipConfirm)] };
      await prisma.adminUser.update({
        where: { id: request.user.id },
        data: { preferences: JSON.stringify(preferences) },
      });
      return preferences;
    }
  );

  // Turn email OTP on or off for the signed-in admin (current password required)
  fastify.patch(
    '/me/login-otp',
    { onRequest: [authenticate], preValidation: [validateBody(loginOtpSettingsSchema)] },
    async (request, reply) => {
      const { enabled, password } = loginOtpSettingsSchema.parse(request.body ?? {});

      const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      const loginOtpEnabled = user.loginOtpEnabled !== enabled ? enabled : user.loginOtpEnabled;
      if (loginOtpEnabled !== user.loginOtpEnabled) {
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { loginOtpEnabled },
        });
      }

      // Switching OTP off must not leave a usable login code behind.
      if (!loginOtpEnabled) {
        await clearChallenges(user.id, 'login');
      }

      return { loginOtpEnabled };
    }
  );

  // Export admin users to CSV. Both permissions are required: holding
  // `exportData` alone must not turn into a directory of every admin account.
  // The `select` is a whitelist — password hashes, permissions, preferences and
  // OTP state are never loaded, so they cannot leak into the file.
  fastify.get(
    '/users/export',
    { onRequest: [authenticate, requirePermission('manageUsers'), requirePermission('exportData')] },
    async (_request, reply) => {
      const users = await prisma.adminUser.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          name: true,
          email: true,
          phone: true,
          role: true,
          roleAr: true,
          department: true,
          departmentRef: { select: { nameAr: true } },
          status: true,
          lastLogin: true,
          loginOtpEnabled: true,
          createdAt: true,
        },
      });

      const headers = [
        'name',
        'email',
        'phone',
        'role',
        'roleAr',
        'department',
        'status',
        'lastLogin',
        'loginOtpEnabled',
        'createdAt',
      ];

      const rows = users.map((user) => [
        user.name,
        user.email,
        user.phone,
        user.role,
        user.roleAr,
        // Same precedence as `serializeUser`: the linked department wins over
        // the free-text snapshot.
        user.departmentRef?.nameAr ?? user.department,
        user.status,
        user.lastLogin,
        user.loginOtpEnabled,
        user.createdAt.toISOString(),
      ]);

      return sendCsv(reply, 'users', buildCsv(headers, rows));
    }
  );

  // List admin users
  fastify.get('/users', { onRequest: [authenticate, requirePermission('manageUsers')] }, async () => {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(serializeUser);
  });

  // Create admin user
  fastify.post(
    '/users',
    { preValidation: [validateBody(createUserSchema)], onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body ?? {});

      let resolvedRoleKey: string = body.role ?? 'sales_agent';
      let resolvedRoleAr: string = body.roleAr ?? 'مسؤول مبيعات';
      let resolvedRoleId: string | null = null;
      let resolvedPermissions: Record<string, boolean> = body.permissions ?? {};

      if (body.roleId) {
        const roleRecord = await prisma.role.findUnique({ where: { id: body.roleId } });
        if (!roleRecord) {
          return reply.status(400).send({ error: 'Role not found' });
        }
        resolvedRoleKey = roleRecord.key;
        resolvedRoleAr = roleRecord.nameAr;
        resolvedRoleId = roleRecord.id;
        if (body.permissions === undefined) {
          const rolePerms = parseRolePermissions(roleRecord.permissions);
          resolvedPermissions = rolePermissionsToUserPermissions(rolePerms);
        }
      } else if (body.role) {
        resolvedRoleKey = body.role;
        const roleRecord = await prisma.role.findUnique({ where: { key: body.role } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          if (!body.roleAr) resolvedRoleAr = roleRecord.nameAr;
        }
      } else {
        const roleRecord = await prisma.role.findUnique({ where: { key: 'sales_agent' } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          resolvedRoleAr = roleRecord.nameAr;
        }
      }

      let resolvedDepartmentText: string | null = body.department ?? null;
      let resolvedDepartmentId: string | null = body.departmentId ?? null;

      if (body.departmentId) {
        const deptRecord = await prisma.department.findUnique({ where: { id: body.departmentId } });
        if (!deptRecord) {
          return reply.status(400).send({ error: 'Department not found' });
        }
        resolvedDepartmentId = deptRecord.id;
        resolvedDepartmentText = deptRecord.nameAr;
      } else if (body.department) {
        const deptRecord = await prisma.department.findUnique({ where: { nameAr: body.department } });
        if (deptRecord) {
          resolvedDepartmentId = deptRecord.id;
        }
      }

      if (resolvedRoleKey === 'super_admin' && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can create a super admin' });
      }

      const existing = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) {
        return reply.status(400).send({ error: 'Email already exists' });
      }

      const targetIsSuperAdmin = resolvedRoleKey === 'super_admin';

      // Only a super admin may grant verifyUsers (it bypasses the email proof).
      if (resolvedPermissions.verifyUsers && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can grant the verifyUsers permission' });
      }

      if (body.mode === 'invite') {
        if (targetIsSuperAdmin) {
          return reply.status(400).send({ error: SUPER_ADMIN_PASSWORD_REQUIRED_ERROR });
        }
        if (body.password !== undefined) {
          return reply.status(400).send({ error: INVITE_PASSWORD_FORBIDDEN_ERROR });
        }
        if (body.sendPasswordInEmail) {
          return reply.status(400).send({ error: SEND_PASSWORD_INVITE_ERROR });
        }
      } else if (!meetsPasswordPolicy(body.password ?? '')) {
        // An admin-chosen password obeys the same policy as a self-service one.
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      // Super admins are the only account that skips verification: born active,
      // with a proven address and no mail. Everyone else starts `pending`.
      const verificationPurpose: EmailVerificationPurpose | null = targetIsSuperAdmin
        ? null
        : body.mode === 'invite'
          ? 'invite'
          : 'verify';

      const passwordHash =
        body.mode === 'invite' ? await hashUnusablePassword() : await bcrypt.hash(body.password!, 10);

      const created = await prisma.adminUser.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
          role: resolvedRoleKey,
          roleAr: resolvedRoleAr,
          roleId: resolvedRoleId,
          department: resolvedDepartmentText,
          departmentId: resolvedDepartmentId,
          permissions: JSON.stringify(resolvedPermissions),
          status: verificationPurpose === null ? 'active' : 'pending',
          emailVerifiedAt: verificationPurpose === null ? new Date() : null,
          // A create-mode account had its password chosen at creation, so record
          // when; an invite account never chose one (stays null until
          // accept-invite), which is what `mark-verified` uses to decide if the
          // user must set a password via "Forgot password".
          ...(body.mode === 'create' ? { passwordChangedAt: new Date() } : {}),
        },
      });

      const mailSent = verificationPurpose
        ? await sendAccountVerificationMail(
            { id: created.id, email: created.email, name: created.name },
            verificationPurpose,
            // The typed password travels in the mail body only: sendMail is
            // called directly inside sendAccountVerificationMail, never via the
            // queue, so it never reaches Redis or a log.
            {
              password:
                verificationPurpose === 'verify' && body.sendPasswordInEmail ? body.password : undefined,
            }
          )
        : true;

      return reply.status(201).send({ ...serializeUser(created), mailSent });
    }
  );

  // Re-send a pending account's verification link (manageUsers)
  fastify.post(
    '/users/:id/resend-verification',
    { onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const { id } = userIdParamsSchema.parse(request.params);
      const user = await prisma.adminUser.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
      if (user.emailVerifiedAt !== null || user.status !== 'pending') {
        return reply.status(409).send({ error: EMAIL_ALREADY_VERIFIED_ERROR });
      }

      // A given account only ever carries one purpose, so the newest link's
      // purpose is the flow it was created with.
      const purpose = (await lastVerificationPurpose(user.id)) ?? 'verify';

      const issuedAt = await latestTokenIssuedAt(user.id, purpose);
      if (issuedAt) {
        const elapsedMs = Date.now() - issuedAt.getTime();
        if (elapsedMs < config.loginOtpResendCooldownMs) {
          reply.header('Retry-After', Math.max(1, Math.ceil((config.loginOtpResendCooldownMs - elapsedMs) / 1000)).toString());
          return reply.status(429).send({ error: RESEND_TOO_SOON_ERROR });
        }
      }

      await sendAccountVerificationMail({ id: user.id, email: user.email, name: user.name }, purpose);
      return { sent: true };
    }
  );

  // Mark a pending account as verified without the emailed link or code
  // (Admin, `verifyUsers` permission). A super admin always holds this
  // permission; only a super admin may grant it to a role or user.
  fastify.post(
    '/users/:id/mark-verified',
    {
      onRequest: [authenticate, requirePermission('verifyUsers')],
    },
    async (request, reply) => {
      const { id } = userIdParamsSchema.parse(request.params);
      const requesterIsSuperAdmin = request.admin?.role === 'super_admin';

      const target = await prisma.adminUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: MARK_VERIFIED_NOT_FOUND });
      }
      if (target.emailVerifiedAt !== null) {
        return reply.status(409).send({ error: MARK_VERIFIED_ALREADY_VERIFIED });
      }

      // A non-super-admin may not act on a super admin account (same rule as
      // other user mutations).
      if (!requesterIsSuperAdmin && target.role === 'super_admin') {
        return reply.status(403).send({ error: MARK_VERIFIED_SUPER_ADMIN_TARGET });
      }

      // Sets the verified timestamp, and activates only a pending account (a
      // suspended account stays suspended). Deletes verification tokens and the
      // email_verification challenges so nothing can be replayed.
      await prisma.adminUser.update({
        where: { id },
        data: {
          emailVerifiedAt: new Date(),
          status: target.status === 'pending' ? 'active' : target.status,
        },
      });
      await prisma.emailVerificationToken.deleteMany({ where: { adminUserId: id, purpose: 'verify' } });
      await prisma.emailVerificationToken.deleteMany({ where: { adminUserId: id, purpose: 'invite' } });
      await clearChallenges(id, 'email_verification');

      // An invite-mode account never chose a password (its hash is unusable),
      // so it must set one via "Forgot password" before it can log in. A
      // create-mode account had its password set at creation
      // (`passwordChangedAt` is set then), so it does not.
      const needsPassword = target.passwordChangedAt === null;

      loggerService.info(
        '[auth] mark-verified',
        { actor: request.admin?.id, target: id, role: target.role, needsPassword },
        'auth'
      );

      return { verified: true, needsPassword };
    }
  );

  // Update admin user (Admin)
  fastify.put(
    '/users/:id',
    { preValidation: [validateBody(updateUserSchema)], onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const { id } = userIdParamsSchema.parse(request.params);
      const body = updateUserSchema.parse(request.body ?? {}) as UpdateUserInput;

      const target = await prisma.adminUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: 'User not found' });
      }

      let resolvedRoleKey: string | undefined = body.role;
      let resolvedRoleAr: string | undefined = body.roleAr;
      let resolvedRoleId: string | null | undefined = body.roleId;
      let resolvedPermissions: Record<string, boolean> | undefined = body.permissions;

      if (body.roleId !== undefined) {
        if (body.roleId) {
          const roleRecord = await prisma.role.findUnique({ where: { id: body.roleId } });
          if (!roleRecord) {
            return reply.status(400).send({ error: 'Role not found' });
          }
          resolvedRoleKey = roleRecord.key;
          resolvedRoleAr = roleRecord.nameAr;
          resolvedRoleId = roleRecord.id;
          if (body.permissions === undefined) {
            const rolePerms = parseRolePermissions(roleRecord.permissions);
            resolvedPermissions = rolePermissionsToUserPermissions(rolePerms);
          }
        } else {
          resolvedRoleId = null;
        }
      } else if (body.role !== undefined) {
        const roleRecord = await prisma.role.findUnique({ where: { key: body.role } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          if (resolvedRoleAr === undefined) resolvedRoleAr = roleRecord.nameAr;
        }
      }

      let resolvedDepartmentText: string | null | undefined = body.department;
      let resolvedDepartmentId: string | null | undefined = body.departmentId;

      if (body.departmentId !== undefined) {
        if (body.departmentId) {
          const deptRecord = await prisma.department.findUnique({ where: { id: body.departmentId } });
          if (!deptRecord) {
            return reply.status(400).send({ error: 'Department not found' });
          }
          resolvedDepartmentId = deptRecord.id;
          resolvedDepartmentText = deptRecord.nameAr;
        } else {
          resolvedDepartmentId = null;
          resolvedDepartmentText = null;
        }
      } else if (body.department !== undefined) {
        if (body.department) {
          const deptRecord = await prisma.department.findUnique({ where: { nameAr: body.department } });
          if (deptRecord) {
            resolvedDepartmentId = deptRecord.id;
          }
        } else {
          resolvedDepartmentId = null;
        }
      }

      // Holding manageUsers must not be a path to super admin: only a super
      // admin may touch a super admin account or hand out that role.
      const requesterIsSuperAdmin = request.admin?.role === 'super_admin';
      if (!requesterIsSuperAdmin && (target.role === 'super_admin' || resolvedRoleKey === 'super_admin')) {
        return reply.status(403).send({ error: 'Only a super admin can modify super admin accounts' });
      }

      // Nobody grants themselves access or lifts their own suspension.
      // The admin form always resends these fields, so only real changes count.
      const currentPermissions = parsePermissions(target.permissions);

      // Only a super admin may newly grant verifyUsers (it bypasses the email
      // proof). An unchanged flag on an existing holder must not block edits.
      if (!requesterIsSuperAdmin && resolvedPermissions?.verifyUsers && !currentPermissions.verifyUsers) {
        return reply.status(403).send({ error: 'Only a super admin can grant the verifyUsers permission' });
      }

      const permissionsChanged =
        resolvedPermissions !== undefined &&
        [...new Set([...Object.keys(resolvedPermissions), ...Object.keys(currentPermissions)])].some(
          (key) => Boolean(resolvedPermissions?.[key]) !== Boolean(currentPermissions[key])
        );
      const changesOwnAccess =
        (resolvedRoleKey !== undefined && resolvedRoleKey !== target.role) ||
        (resolvedRoleId !== undefined && resolvedRoleId !== target.roleId) ||
        (body.status !== undefined && body.status !== target.status) ||
        permissionsChanged;
      if (request.admin?.id === id && changesOwnAccess) {
        return reply.status(403).send({ error: 'You cannot change your own role, status or permissions' });
      }

      if (body.email && body.email.toLowerCase() !== target.email) {
        const existing = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
        if (existing) {
          return reply.status(400).send({ error: 'Email already exists' });
        }
      }

      // Guard the last usable super admin so the portal cannot be locked out.
      const losingSuperAdmin =
        target.role === 'super_admin' &&
        ((resolvedRoleKey !== undefined && resolvedRoleKey !== 'super_admin') || body.status === 'suspended');

      if (losingSuperAdmin) {
        const activeSuperAdmins = await prisma.adminUser.count({
          where: { role: 'super_admin', status: 'active' },
        });
        if (activeSuperAdmins <= 1) {
          return reply.status(400).send({ error: 'Cannot demote or suspend the last active super admin' });
        }
      }

      // A pending account must prove its address through the emailed link, never
      // through an admin flipping its status here — that would bypass verification.
      if (body.status === 'active' && target.status !== 'active' && target.emailVerifiedAt === null) {
        return reply.status(400).send({ error: PENDING_ACTIVATION_ERROR });
      }

      // An admin-chosen password obeys the same policy as a self-service one.
      if (body.password !== undefined && !meetsPasswordPolicy(body.password)) {
        return reply.status(400).send({ error: PASSWORD_POLICY_ERROR });
      }

      const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;

      const updated = await prisma.adminUser.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email ? body.email.toLowerCase() : undefined,
          passwordHash,
          role: resolvedRoleKey,
          roleAr: resolvedRoleAr,
          roleId: resolvedRoleId !== undefined ? resolvedRoleId : undefined,
          department: resolvedDepartmentText !== undefined ? resolvedDepartmentText : undefined,
          departmentId: resolvedDepartmentId !== undefined ? resolvedDepartmentId : undefined,
          permissions: resolvedPermissions ? JSON.stringify(resolvedPermissions) : undefined,
          status: body.status,
        },
      });

      return serializeUser(updated);
    }
  );

  // Delete admin user (Admin)
  fastify.delete('/users/:id', { onRequest: [authenticate, requirePermission('manageUsers')] }, async (request, reply) => {
    const { id } = userIdParamsSchema.parse(request.params);

    if (request.user.id === id) {
      return reply.status(400).send({ error: 'You cannot delete your own account' });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (target.role === 'super_admin') {
      if (request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can delete a super admin' });
      }
      const activeSuperAdmins = await prisma.adminUser.count({
        where: { role: 'super_admin', status: 'active' },
      });
      if (activeSuperAdmins <= 1) {
        return reply.status(400).send({ error: 'Cannot delete the last active super admin' });
      }
    }

    await prisma.adminUser.delete({ where: { id } });
    return { success: true };
  });
};