import { prisma } from './prisma.js';
import { hasPermission } from '../middleware/auth.js';
import { parsePermissions } from '../config/permissions.js';

/**
 * Listeners decide who is told about an event and how. The events are
 * (`inquiry.created`, `job_application`) and there is one channel (`email`);
 * both are enums so WhatsApp or webhooks can be added without a schema change.
 *
 * The "the team took control" state is per event: a listener for one event
 * never silences another one. Until a listener exists for an event, that
 * event's pre-listener behaviour applies (the caller's legacy recipients).
 * Creating one records that the team took control of *that* event, so
 * deleting every listener of an event afterwards means "notify nobody" for
 * that event rather than silently falling back.
 */

export const NOTIFICATION_EVENTS = ['inquiry.created', 'job_application'] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Admin-facing names for the event keys, so a listener form can label them. */
export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, { labelAr: string; labelEn: string }> = {
  'inquiry.created': {
    labelAr: 'عند وصول طلب اهتمام جديد',
    labelEn: 'When a new inquiry arrives',
  },
  job_application: {
    labelAr: 'عند وصول طلب توظيف جديد',
    labelEn: 'When a new job application arrives',
  },
};

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

/**
 * The settings row that records "the team configured this event". Every event
 * has its own row, so configuring one never silences another one.
 *
 * `inquiry.created` keeps the historical `notifications` key: an existing
 * deployment must behave exactly as it did before the rows were split.
 */
const CONFIGURED_KEYS: Record<NotificationEvent, string> = {
  'inquiry.created': 'notifications',
  'job_application': 'notifications.job_application',
};

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

/** True once a listener for this event was created: the team took over. */
export async function listenersConfigured(event: NotificationEvent): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: CONFIGURED_KEYS[event] } });
  return row !== null;
}

/** The configured state of every event, for the admin panel. */
export async function configuredEvents(): Promise<Record<NotificationEvent, boolean>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(CONFIGURED_KEYS) } },
    select: { key: true },
  });
  const present = new Set(rows.map((row) => row.key));
  return Object.fromEntries(
    NOTIFICATION_EVENTS.map((event) => [event, present.has(CONFIGURED_KEYS[event])])
  ) as Record<NotificationEvent, boolean>;
}

export async function listListeners(): Promise<ListenerView[]> {
  const rows = await prisma.notificationListener.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toView);
}

export async function createListener(input: ListenerInput, adminId: string): Promise<ListenerView> {
  const key = CONFIGURED_KEYS[input.event];
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.notificationListener.create({
      data: { ...input, config: normaliseConfig(input.config), createdById: adminId },
    });
    // The row marks *this* event as configured; the other events keep theirs.
    await tx.appSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify({ listenersConfigured: true }), updatedById: adminId },
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
  const key = CONFIGURED_KEYS[input.event];
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.notificationListener.update({
      where: { id },
      data: { ...input, config: normaliseConfig(input.config) },
    });
    // The event may have changed: the new one is configured from now on.
    await tx.appSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify({ listenersConfigured: true }) },
      update: {},
    });
    return updated;
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
 * listener was ever configured *for this event* and the caller should use its
 * legacy recipients.
 */
export async function emailRecipientsFor(event: NotificationEvent): Promise<string[] | null> {
  if (!(await listenersConfigured(event))) return null;

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


