import { config } from '../config/env.js';
import { sendMail } from '../services/mailService.js';
import { developerNoteNotification, type InquiryMailData } from '../services/mailTemplates.js';
import { notifyNewInquiry } from '../services/notificationService.js';
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
 * loop off the event loop between sends. A single bad recipient cannot lose the
 * others: `sendMail` reports its own failures without throwing.
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
