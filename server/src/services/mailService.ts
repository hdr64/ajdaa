import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import type { MailKind } from './mailTemplates.js';

/**
 * Outgoing mail.
 *
 * Two transports, one code path:
 *
 * - **SMTP** when `MAIL_HOST` is set and `NODE_ENV !== 'test'`. `tls` upgrades
 *   the connection with STARTTLS (the usual port 587 setup), `ssl` negotiates
 *   implicit TLS (port 465), `none` is plaintext.
 * - **In-memory** otherwise, so the test suite (and any deployment that has not
 *   configured SMTP) exercises the same call sites without a network. Messages
 *   land in `getSentMail()` and the service logs only "mail disabled" — never
 *   a recipient, a subject or a body.
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

function createSmtpTransport(): MailSender {
  const transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    // STARTTLS is an upgrade on an already-open connection, so `secure` is false.
    secure: config.mail.encryption === 'ssl',
    requireTLS: config.mail.encryption === 'tls',
    ignoreTLS: config.mail.encryption === 'none',
    auth: config.mail.username
      ? { user: config.mail.username, pass: config.mail.password }
      : undefined,
  });

  return async (message) => transport.sendMail(message);
}

function createMemoryTransport(): MailSender {
  return async ({ kind, to, subject, html, text }) => {
    sentMail.push({ kind, to, subject, html, text, sentAt: new Date() });
    return { messageId: `memory-${sentMail.length}` };
  };
}

let transport: MailSender | undefined;
let disabledLogged = false;

function resolveTransport(): MailSender {
  if (transport) return transport;
  transport = config.mail.enabled ? createSmtpTransport() : createMemoryTransport();
  return transport;
}

/** Every message captured by the in-memory transport, oldest first. */
export function getSentMail(): readonly SentMail[] {
  return sentMail;
}

export function clearSentMail(): void {
  sentMail.length = 0;
}

/** True when mail would really leave the process. */
export function isMailEnabled(): boolean {
  return config.mail.enabled;
}

export function fromAddress(): string {
  return `"${config.mail.fromName}" <${config.mail.fromAddress}>`;
}

export async function sendMail(message: OutgoingMail): Promise<void> {
  if (!config.mail.enabled && !disabledLogged) {
    disabledLogged = true;
    console.warn('[mail] mail disabled: no MAIL_HOST configured (or NODE_ENV=test) — messages are not delivered');
  }

  try {
    await resolveTransport()({ ...message, from: fromAddress() });
  } catch (error) {
    // Recipient, subject and body are deliberately omitted: the inquiry
    // notification interpolates a public form, and the reset mail an address, so
    // logging any of it would spill customer PII into the log file. `kind` is a
    // fixed template id and identifies the failing mail on its own.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[mail] failed to send "${message.kind}": ${reason}`);
  }
}
