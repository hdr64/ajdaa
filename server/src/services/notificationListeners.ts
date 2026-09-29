import { prisma } from './prisma.js';
import { hasPermission } from '../middleware/auth.js';
import { parsePermissions } from '../config/permissions.js';

/**
 * Listeners decide who is told about an event and how. Today there is one event
 * (`inquiry.created`) and one channel (`email`); both are enums so WhatsApp or
 * webhooks can be added without a schema change.
 *
 * Until someone creates the first listener, the pre-listener behaviour applies
 * (the caller's legacy recipients). Creating one records that the team took
 * control, so deleting every listener afterwards means "notify nobody" rather
 * than silently falling back.
 */

export const NOTIFICATION_EVENTS = ['inquiry.created'] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_CHANNELS = ['email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface EmailListenerConfig {
  /** Every active admin who can view inquiries (the PII in the mail is theirs to see). */
  toInquiryViewers: boolean;
  emails: string[];
}

export interface ListenerInput {
  event: NotificationEvent;
  channel: NotificationChannel;
  name: string;
  enabled: boolean;
  config: EmailListenerConfig;
}

export interface ListenerView extends ListenerInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const CONFIGURED_KEY = 'notifications';

function parseConfig(raw: string): EmailListenerConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<EmailListenerConfig>;
    return {
      toInquiryViewers: parsed.toInquiryViewers === true,
      emails: Array.isArray(parsed.emails) ? parsed.emails.filter((e): e is string => typeof e === 'string') : [],
    };
  } catch {
    return { toInquiryViewers: false, emails: [] };
  }
}

function toView(row: {
  id: string;
  event: string;
  channel: string;
  name: string;
  enabled: boolean;
  config: string;
  createdAt: Date;
  updatedAt: Date;
}): ListenerView {
  return {
    id: row.id,
    event: row.event as NotificationEvent,
    channel: row.channel as NotificationChannel,
    name: row.name,
    enabled: row.enabled,
    config: parseConfig(row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lower-cased and de-duplicated, so one address is never mailed twice by one listener. */
function normaliseConfig(config: EmailListenerConfig): string {
  const emails = [...new Set(config.emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  return JSON.stringify({ toInquiryViewers: config.toInquiryViewers, emails });
}

export async function listenersConfigured(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: CONFIGURED_KEY } });
  return row !== null;
}

export async function listListeners(): Promise<ListenerView[]> {
  const rows = await prisma.notificationListener.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toView);
}

export async function createListener(input: ListenerInput, adminId: string): Promise<ListenerView> {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.notificationListener.create({
      data: { ...input, config: normaliseConfig(input.config), createdById: adminId },
    });
    await tx.appSetting.upsert({
      where: { key: CONFIGURED_KEY },
      create: { key: CONFIGURED_KEY, value: JSON.stringify({ listenersConfigured: true }), updatedById: adminId },
      update: {},
    });
    return created;
  });
  return toView(row);
}

/** Null when the listener does not exist. */
export async function updateListener(id: string, input: ListenerInput): Promise<ListenerView | null> {
  const existing = await prisma.notificationListener.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.notificationListener.update({
    where: { id },
    data: { ...input, config: normaliseConfig(input.config) },
  });
  return toView(row);
}

export async function deleteListener(id: string): Promise<boolean> {
  const result = await prisma.notificationListener.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function activeInquiryViewerEmails(): Promise<string[]> {
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

/**
 * Email recipients for an event, de-duplicated across listeners. Null means no
 * listener was ever configured and the caller should use its legacy recipients.
 */
export async function emailRecipientsFor(event: NotificationEvent): Promise<string[] | null> {
  if (!(await listenersConfigured())) return null;

  const listeners = await prisma.notificationListener.findMany({
    where: { event, channel: 'email', enabled: true },
  });
  const recipients = new Set<string>();
  let viewers: string[] | undefined;

  for (const listener of listeners) {
    const config = parseConfig(listener.config);
    if (config.toInquiryViewers) {
      viewers ??= await activeInquiryViewerEmails();
      viewers.forEach((email) => recipients.add(email.toLowerCase()));
    }
    config.emails.forEach((email) => recipients.add(email));
  }
  return [...recipients];
}


