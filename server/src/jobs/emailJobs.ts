import { config } from '../config/env.js';
import { mailBrandName, sendMail } from '../services/mailService.js';
import { developerNoteNotification, emailVerificationEmail, inviteEmail, passwordChangeCodeEmail, loginOtpActivationEmail, type InquiryMailData } from '../services/mailTemplates.js';
import { notifyNewInquiry, notifyNewJobApplication } from '../services/notificationService.js';
import { EMAIL_VERIFICATION_TTL_MS } from '../services/emailVerificationService.js';
import { ttlMinutes } from '../services/otpService.js';
import type { QueueableJob } from '../services/queueService.js';

/**
 * Email jobs.
 *
 * Each export is a `QueueableJob`: a plain, serialisable payload plus a handler.
 * That is the whole contract the queue engine needs, which is what lets the
 * identical code run either as a BullMQ job (Redis present) or inline
 * (`dispatch` falling back), with no branching at the call sites.
 *
 * Payloads carry only data — never closures — because anything handed to
 * BullMQ is JSON-encoded on its way into Redis.
 */

export interface DeveloperNoteMailPayload {
  noteId: string;
  title: string;
  section: string;
  body: string;
  solution?: string | null;
  screenshotUrl?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  priority: string;
}

/**
 * Alerts the developer inbox about a new developer note.
 *
 * Recipients come from `config.developer.emails`, and `Promise.all` keeps the
 * loop off the event loop between sends. A failing transport rejects the
 * handler, which is what makes the queue retry the delivery.
 */
export const sendDeveloperNoteEmailJob: QueueableJob<DeveloperNoteMailPayload> = {
  name: 'email:developer-note',

  async handle(payload) {
    const recipients = config.developer.emails;
    if (recipients.length === 0) return;

    const content = developerNoteNotification({
      brandName: config.mail.fromName,
      appUrl: config.appUrl,
      title: payload.title,
      section: payload.section,
      body: payload.body,
      solution: payload.solution,
      screenshotUrl: payload.screenshotUrl,
      adminName: payload.adminName,
      adminEmail: payload.adminEmail,
      priority: payload.priority,
    });

    await Promise.all(recipients.map((to) => sendMail({ to, ...content })));
  },
};

/**
 * Mirrors `InquiryMailData`, the shape `newInquiryEmail` renders. The dashboard
 * URL is derived from `config.appUrl` inside the job so it does not have to be
 * part of the queued payload.
 */
export type InquiryNotificationPayload = InquiryMailData;

/**
 * Alerts the admins watching inquiries about a captured lead.
 *
 * Recipients are resolved by the existing listener rules, deliberately left
 * inside the job: they are a database lookup, and doing it at dispatch time
 * would put that query back on the request's critical path.
 */
export const sendInquiryNotificationJob: QueueableJob<InquiryNotificationPayload> = {
  name: 'email:new-inquiry',

  async handle(payload) {
    // `notifyNewInquiry` already owns recipient selection (configured
    // listeners, then the NOTIFY_INQUIRY_EMAILS allowlist, then every admin who
    // can view inquiries), the brand name and the dashboard URL. Delegating keeps
    // a single source of truth for that routing, so the queued and inline paths
    // cannot drift apart, and it means the payload stays exactly the data the
    // template renders.
    await notifyNewInquiry(payload);
  },
};

export interface JobApplicationNotificationPayload {
  name: string | null;
  jobTitle: string | null;
  createdAt: string | Date | null;
}

export const sendJobApplicationNotificationJob: QueueableJob<JobApplicationNotificationPayload> = {
  name: 'email:job-application',

  async handle(payload) {
    await notifyNewJobApplication(payload);
  },
};

/**
 * The invite for a user added without a password. The link URL is derived from
 * `config.appUrl` inside the job so the queued payload stays just the data the
 * template needs. A rejected `sendMail` fails the handler, which is what lets
 * the queue retry the delivery.
 */
export interface InviteEmailPayload {
  to: string;
  name?: string | null;
  token: string;
}

export const sendInviteEmailJob: QueueableJob<InviteEmailPayload> = {
  name: 'email:invite',

  async handle(payload) {
    const content = inviteEmail({
      brandName: await mailBrandName(),
      name: payload.name,
      inviteUrl: `${config.appUrl}/admin/accept-invite?token=${encodeURIComponent(payload.token)}`,
      expiresInDays: Math.round(EMAIL_VERIFICATION_TTL_MS.invite / (24 * 60 * 60 * 1000)),
    });
    await sendMail({ to: payload.to, ...content });
  },
};

export interface EmailVerificationPayload {
  to: string;
  name?: string | null;
  token: string;
  /** 6-digit code shown in the mail (create mode only); absent for invite mode. */
  code?: string | null;
  /** Code lifetime in whole minutes, for the email wording. */
  codeExpiresInMinutes?: number;
}

/** Confirms a create-mode account's address so it can leave `pending`. */
export const sendEmailVerificationJob: QueueableJob<EmailVerificationPayload> = {
  name: 'email:verify-email',

  async handle(payload) {
    const content = emailVerificationEmail({
      brandName: await mailBrandName(),
      name: payload.name,
      verifyUrl: `${config.appUrl}/admin/verify-email?token=${encodeURIComponent(payload.token)}`,
      expiresInHours: Math.round(EMAIL_VERIFICATION_TTL_MS.verify / (60 * 60 * 1000)),
      code: payload.code ?? undefined,
      codeExpiresInMinutes: payload.codeExpiresInMinutes,
    });
    await sendMail({ to: payload.to, ...content });
  },
};

export interface PasswordChangeCodePayload {
  to: string;
  name?: string | null;
  code: string;
}

/** Emails the confirmation code that gates a self-service password change. */
export const sendPasswordChangeCodeJob: QueueableJob<PasswordChangeCodePayload> = {
  name: 'email:password-change-code',

  async handle(payload) {
    const content = passwordChangeCodeEmail({
      brandName: await mailBrandName(),
      name: payload.name,
      code: payload.code,
      expiresInMinutes: ttlMinutes(),
    });
    await sendMail({ to: payload.to, ...content });
  },
};

export interface LoginOtpActivationCodePayload {
  to: string;
  name?: string | null;
  code: string;
}

/** Emails the confirmation code that verifies email ownership before activating login OTP. */
export const sendLoginOtpActivationCodeJob: QueueableJob<LoginOtpActivationCodePayload> = {
  name: 'email:login-otp-activation-code',

  async handle(payload) {
    const content = loginOtpActivationEmail({
      brandName: await mailBrandName(),
      name: payload.name,
      code: payload.code,
      expiresInMinutes: ttlMinutes(),
    });
    await sendMail({ to: payload.to, ...content });
  },
};

