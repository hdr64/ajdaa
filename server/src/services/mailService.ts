import nodemailer from 'nodemailer';
import { testEmail, type MailKind } from './mailTemplates.js';
import {
  brandNameOf,
  canDeliver,
  getEffectiveMailSettings,
  mailSettingsVersion,
  type MailSettings,
} from './mailSettings.js';

/**
 * Outgoing mail.
 *
 * Two transports, one code path:
 *
 * - **SMTP** when a host is configured and `NODE_ENV !== 'test'`. `tls` upgrades
 *   the connection with STARTTLS (the usual port 587 setup), `ssl` negotiates
 *   implicit TLS (port 465), `none` is plaintext.
 * - **In-memory** otherwise, so the test suite (and any deployment that has not
 *   configured SMTP) exercises the same call sites without a network. Messages
 *   land in `getSentMail()` and the service logs only "mail disabled" — never
 *   a recipient, a subject or a body.
 *
 * The settings come from `mailSettings.ts` (admin-saved values, else `.env`);
 * the transport is rebuilt whenever they change.
 *
 * `sendMail` never throws. A failed notification must not turn a successful
 * inquiry or password change into a 500, so failures are logged and swallowed;
 * flows that genuinely depend on a message being delivered (the OTP codes) are
 * written so the caller can still answer the client sensibly.
 */

export interface OutgoingMail {
  kind: MailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SentMail extends OutgoingMail {
  sentAt: Date;
}

type MailSender = (message: OutgoingMail & { from: string }) => Promise<unknown>;

const sentMail: SentMail[] = [];

/** Bounded so a wrong host or port fails the admin's test within seconds, not minutes. */
const SMTP_TIMEOUT_MS = 10_000;

function createSmtpTransport(settings: MailSettings): MailSender {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    // STARTTLS is an upgrade on an already-open connection, so `secure` is false.
    secure: settings.encryption === 'ssl',
    requireTLS: settings.encryption === 'tls',
    ignoreTLS: settings.encryption === 'none',
    auth: settings.username ? { user: settings.username, pass: settings.password } : undefined,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  return async (message) => transport.sendMail(message);
}

function createMemoryTransport(): MailSender {
  return async ({ kind, to, subject, html, text }) => {
    sentMail.push({ kind, to, subject, html, text, sentAt: new Date() });
    return { messageId: `memory-${sentMail.length}` };
  };
}

function createTransport(settings: MailSettings): MailSender {
  return canDeliver(settings) ? createSmtpTransport(settings) : createMemoryTransport();
}

let transport: { sender: MailSender; version: number } | undefined;
let disabledLogged = false;

function resolveTransport(settings: MailSettings): MailSender {
  const version = mailSettingsVersion();
  if (!transport || transport.version !== version) {
    transport = { sender: createTransport(settings), version };
  }
  return transport.sender;
}

/** Every message captured by the in-memory transport, oldest first. */
export function getSentMail(): readonly SentMail[] {
  return sentMail;
}

export function clearSentMail(): void {
  sentMail.length = 0;
}

/** True when mail would really leave the process. */
export async function isMailEnabled(): Promise<boolean> {
  return canDeliver(await getEffectiveMailSettings());
}

function fromHeader(settings: MailSettings): string {
  return `"${brandNameOf(settings)}" <${settings.fromAddress}>`;
}

/** Brand name shown in templates, following the saved settings. */
export async function mailBrandName(): Promise<string> {
  return brandNameOf(await getEffectiveMailSettings());
}

export async function sendMail(message: OutgoingMail): Promise<void> {
  try {
    const settings = await getEffectiveMailSettings();
    if (!canDeliver(settings) && !disabledLogged) {
      disabledLogged = true;
      console.warn('[mail] mail disabled: no SMTP host configured (or NODE_ENV=test) — messages are not delivered');
    }
    await resolveTransport(settings)({ ...message, from: fromHeader(settings) });
  } catch (error) {
    // Recipient, subject and body are deliberately omitted: the inquiry
    // notification interpolates a public form, and the reset mail an address, so
    // logging any of it would spill customer PII into the log file. `kind` is a
    // fixed template id and identifies the failing mail on its own.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[mail] failed to send "${message.kind}": ${reason}`);
  }
}

/**
 * Sends the admin's test message with the given (possibly unsaved) settings on a
 * one-off transport. Unlike `sendMail` it throws, so the admin sees the SMTP error.
 */
export async function sendTestMail(settings: MailSettings, to: string): Promise<{ messageId?: string }> {
  const content = testEmail({ brandName: brandNameOf(settings), host: settings.host || '—' });
  const result = await createTransport(settings)({ to, ...content, from: fromHeader(settings) });
  const messageId = (result as { messageId?: unknown } | undefined)?.messageId;
  return { messageId: typeof messageId === 'string' ? messageId : undefined };
}
