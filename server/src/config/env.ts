import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters. Generate one with `openssl rand -base64 32`.'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  TRUST_PROXY: z
    .string()
    .optional()
    .default('true')
    .transform((val) => val === 'true' || val === '1'),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(process.env.NODE_ENV === 'test' ? 100 : 10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  LOGIN_FAIL_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_FAIL_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_INQUIRIES_MAX: z.coerce.number().int().positive().default(process.env.NODE_ENV === 'test' ? 100 : 10),
  RATE_LIMIT_INQUIRIES_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  RATE_LIMIT_NEWSLETTER_MAX: z.coerce.number().int().positive().default(process.env.NODE_ENV === 'test' ? 100 : 5),
  RATE_LIMIT_NEWSLETTER_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  RATE_LIMIT_OTP_MAX: z.coerce.number().int().positive().default(process.env.NODE_ENV === 'test' ? 100 : 20),
  RATE_LIMIT_OTP_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_PASSWORD_RESET_MAX: z.coerce
    .number()
    .int()
    .positive()
    .default(process.env.NODE_ENV === 'test' ? 100 : 5),
  RATE_LIMIT_PASSWORD_RESET_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  // --- Email (SMTP) ---
  // An empty MAIL_HOST is not an error: the API must boot without SMTP so a
  // deployment can run with notifications silently disabled.
  MAIL_HOST: z.string().trim().default(''),
  MAIL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  MAIL_USERNAME: z.string().trim().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_ENCRYPTION: z.enum(['tls', 'ssl', 'none']).default('tls'),
  // An empty value (`MAIL_FROM_ADDRESS=`) is allowed, like the other MAIL_* keys.
  MAIL_FROM_ADDRESS: z.string().trim().pipe(z.union([z.literal(''), z.string().email()])).default(''),
  MAIL_FROM_NAME: z.string().trim().default(''),
  // Key for secrets saved from the admin (the SMTP password). Unset: derived from
  // JWT_SECRET, so rotating that secret means re-entering the SMTP password.
  SETTINGS_ENCRYPTION_KEY: z.string().default(''),

  // Absolute base used for links inside emails (e.g. the admin inquiries page).
  APP_URL: z
    .string()
    .trim()
    .url()
    .default('https://ajda.weghetk.com')
    .transform((value) => value.replace(/\/+$/, '')),

  // --- Email OTP ---
  // When true every admin login needs a one-time code; otherwise only accounts
  // with `AdminUser.loginOtpEnabled` do.
  LOGIN_OTP_REQUIRED: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  LOGIN_OTP_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  LOGIN_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_OTP_RESEND_COOLDOWN_MS: z.coerce.number().int().positive().default(60 * 1000),

  // Comma-separated allowlist. Empty = notify every active admin who can see
  // inquiries; when set, only these recipients are notified.
  NOTIFY_INQUIRY_EMAILS: z.string().default(''),

  // --- Production Logs & Monitoring ---
  LOG_FILE_PATH: z.string().default('./prod.log'),
  LOGS_SECRET_KEY: z.string().default('ajda-logs-secret-2026'),
  LOGS_PUBLIC: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const env = parsed.data;

// CLIENT_ORIGIN is documented as a comma-separated list, so honour that instead
// of treating the whole string as one unmatched origin.
const configuredOrigins = env.CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Dev conveniences are opt-in: in production a page on a developer's localhost
// must not be able to make credentialed cross-origin calls to the live API.
const devOrigins =
  env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Kept mutable: @fastify/cors and socket.io both require a non-readonly array.
const clientOrigins: string[] = [...new Set([...configuredOrigins, ...devOrigins])];

// Same comma-separated convention as CLIENT_ORIGIN. An empty list means "derive
// the recipients from permissions instead".
const notifyInquiryEmails: string[] = env.NOTIFY_INQUIRY_EMAILS.split(',')
  .map((address) => address.trim().toLowerCase())
  .filter(Boolean);

/** Display name for outgoing mail; falls back to the from address, then to a literal. */
const mailFromName = env.MAIL_FROM_NAME || env.MAIL_FROM_ADDRESS || 'Ajda';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  settingsEncryptionKey: env.SETTINGS_ENCRYPTION_KEY,
  uploadDir: path.resolve(env.UPLOAD_DIR),
  clientOrigins,
  trustProxy: env.TRUST_PROXY,
  rateLimitGlobalMax: env.RATE_LIMIT_GLOBAL_MAX,
  rateLimitLoginMax: env.RATE_LIMIT_LOGIN_MAX,
  rateLimitLoginWindowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  loginFailMax: env.LOGIN_FAIL_MAX,
  loginFailWindowMs: env.LOGIN_FAIL_WINDOW_MS,
  rateLimitInquiriesMax: env.RATE_LIMIT_INQUIRIES_MAX,
  rateLimitInquiriesWindowMs: env.RATE_LIMIT_INQUIRIES_WINDOW_MS,
  rateLimitNewsletterMax: env.RATE_LIMIT_NEWSLETTER_MAX,
  rateLimitNewsletterWindowMs: env.RATE_LIMIT_NEWSLETTER_WINDOW_MS,
  rateLimitOtpMax: env.RATE_LIMIT_OTP_MAX,
  rateLimitOtpWindowMs: env.RATE_LIMIT_OTP_WINDOW_MS,
  rateLimitPasswordResetMax: env.RATE_LIMIT_PASSWORD_RESET_MAX,
  rateLimitPasswordResetWindowMs: env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS,
  appUrl: env.APP_URL,
  loginOtpRequired: env.LOGIN_OTP_REQUIRED,
  loginOtpTtlMs: env.LOGIN_OTP_TTL_MS,
  loginOtpMaxAttempts: env.LOGIN_OTP_MAX_ATTEMPTS,
  loginOtpResendCooldownMs: env.LOGIN_OTP_RESEND_COOLDOWN_MS,
  notifyInquiryEmails,
  mail: {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    username: env.MAIL_USERNAME,
    password: env.MAIL_PASSWORD,
    /** `ssl` maps to implicit TLS (port 465); `tls` upgrades over STARTTLS (587). */
    encryption: env.MAIL_ENCRYPTION,
    fromAddress: env.MAIL_FROM_ADDRESS,
    fromName: mailFromName,
    /** True when SMTP is configured and the process is not a test run. */
    enabled: env.MAIL_HOST.length > 0 && env.NODE_ENV !== 'test',
  },
  logs: {
    filePath: path.resolve(env.LOG_FILE_PATH),
    secretKey: env.LOGS_SECRET_KEY,
    isPublic: env.LOGS_PUBLIC,
  },
} as const;

export type Config = typeof config;