import { config } from '../config/env.js';
import { mailBrandName, sendMail } from './mailService.js';
import { newInquiryEmail, passwordChangedEmail } from './mailTemplates.js';
import { activeInquiryViewerEmails, emailRecipientsFor } from './notificationListeners.js';

/**
 * Outbound admin notifications.
 *
 * Both entry points are fire-and-forget: the caller has already answered the
 * client, so a slow or failing SMTP handshake must not surface as an error. Each
 * function swallows its own failures (mail sending already does) and reports
 * how many messages went out, which is what the tests assert on.
 */

const INQUIRIES_PATH = '/admin/inquiries';

export function inquiryDashboardUrl(): string {
  return `${config.appUrl}${INQUIRIES_PATH}`;
}

interface InquiryMailInput {
  name: string | null;
  phone: string | null;
  email: string | null;
  projectTitle: string | null;
  unitNumber: string | null;
  interestTypeAr: string | null;
  message: string | null;
}

/**
 * Configured listeners decide the recipients. Before any listener exists, the
 * original rule applies: the `NOTIFY_INQUIRY_EMAILS` allowlist if set, else
 * every active admin who can see the inquiry (the body carries customer PII).
 */
async function inquiryRecipients(): Promise<string[]> {
  const configured = await emailRecipientsFor('inquiry.created');
  if (configured !== null) return configured;
  if (config.notifyInquiryEmails.length > 0) return config.notifyInquiryEmails;
  return activeInquiryViewerEmails();
}

export async function notifyNewInquiry(inquiry: InquiryMailInput): Promise<number> {
  const recipients = await inquiryRecipients();
  if (recipients.length === 0) return 0;

  const content = newInquiryEmail({
    brandName: await mailBrandName(),
    inquiry,
    dashboardUrl: inquiryDashboardUrl(),
  });

  await Promise.all(recipients.map((to) => sendMail({ to, ...content })));
  return recipients.length;
}

export async function notifyPasswordChanged(input: {
  email: string;
  name?: string | null;
  via: 'self_service' | 'reset';
}): Promise<void> {
  const content = passwordChangedEmail({
    brandName: await mailBrandName(),
    name: input.name,
    via: input.via,
  });

  await sendMail({ to: input.email, ...content });
}
