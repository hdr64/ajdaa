import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { sendMail } from './mailService.js';
import { newInquiryEmail, passwordChangedEmail } from './mailTemplates.js';
import { hasPermission } from '../middleware/auth.js';
import { parsePermissions } from '../config/permissions.js';

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
 * Recipients are the active admins who can actually see the inquiry, because the
 * body carries customer PII — unless `NOTIFY_INQUIRY_EMAILS` names an explicit
 * allowlist, in which case only those addresses are used.
 */
async function inquiryRecipients(): Promise<string[]> {
  if (config.notifyInquiryEmails.length > 0) {
    return config.notifyInquiryEmails;
  }

  const admins = await prisma.adminUser.findMany({
    where: { status: 'active' },
    select: { email: true, role: true, permissions: true },
  });

  return admins
    .filter((admin) =>
      hasPermission(
        { id: '', email: admin.email, role: admin.role, permissions: parsePermissions(admin.permissions) },
        'viewInquiries'
      )
    )
    .map((admin) => admin.email);
}

export async function notifyNewInquiry(inquiry: InquiryMailInput): Promise<number> {
  const recipients = await inquiryRecipients();
  if (recipients.length === 0) return 0;

  const content = newInquiryEmail({
    brandName: config.mail.fromName,
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
    brandName: config.mail.fromName,
    name: input.name,
    via: input.via,
  });

  await sendMail({ to: input.email, ...content });
}
