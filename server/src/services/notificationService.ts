import { config } from '../config/env.js';
import { mailBrandName, sendMail } from './mailService.js';
import { jobApplicationEmail, newInquiryEmail, passwordChangedEmail } from './mailTemplates.js';
import { activeApplicationViewerEmails, activeInquiryViewerEmails, emailRecipientsFor } from './notificationListeners.js';
import { getCareersNotificationEmails } from './careersSettings.js';

/**
 * Outbound admin notifications.
 *
 * `notifyNewInquiry` runs inside the job queue, so a failing SMTP handshake
 * propagates: the queue retries the delivery instead of losing it.
 *
 * `notifyPasswordChanged` is fire-and-forget — the caller has already answered
 * the client — so it swallows its own failures.
 */

const INQUIRIES_PATH = '/admin/inquiries';
const APPLICATIONS_PATH = '/admin/applications';

export function inquiryDashboardUrl(inquiryId?: string | null): string {
  const path = inquiryId ? `${INQUIRIES_PATH}/${encodeURIComponent(inquiryId)}` : INQUIRIES_PATH;
  return `${config.appUrl}${path}`;
}

export function applicationDashboardUrl(): string {
  return `${config.appUrl}${APPLICATIONS_PATH}`;
}

interface InquiryMailInput {
  id?: string | null;
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
    dashboardUrl: inquiryDashboardUrl(inquiry.id),
  });

  await Promise.all(recipients.map((to) => sendMail({ to, ...content })));
  return recipients.length;
}

interface JobApplicationMailInput {
  name: string | null;
  jobTitle: string | null;
  createdAt: string | Date | null;
}

async function applicationRecipients(): Promise<string[]> {
  const configured = await emailRecipientsFor('job_application');
  if (configured !== null) return configured;
  const settingsEmails = await getCareersNotificationEmails();
  if (settingsEmails.length > 0) return settingsEmails;
  return activeApplicationViewerEmails();
}

export async function notifyNewJobApplication(application: JobApplicationMailInput): Promise<number> {
  const recipients = await applicationRecipients();
  if (recipients.length === 0) return 0;

  const content = jobApplicationEmail({
    brandName: await mailBrandName(),
    application,
    dashboardUrl: applicationDashboardUrl(),
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

  try {
    await sendMail({ to: input.email, ...content });
  } catch (error) {
    // The password is already changed and the caller has been answered: a
    // failed notification must not turn that into an error. The mail service
    // has already logged the reason.
    console.error(
      `[mail] password-change notification failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
