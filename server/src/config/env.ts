import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

/**
 * Shortest secret accepted in production. 24 characters is long enough that a
 * shared secret cannot be guessed from a leaked word list.
 */
const MIN_SECRET_LENGTH = 24;

/** Production JWT secrets must be long enough to resist offline brute force. */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Values that are never acceptable as a production secret: the literal
 * placeholders people copy, plus the example value shipped in `.env.example`.
 */
const PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'change_me',
  'change-me',
  'secret',
  'secrets',
  'password',
  'password123',
  'placeholder',
  'example',
  'your-secret-key',
  'your_secret_key',
  'yoursecretkey',
  'ajda_secret_development_key_super_secure_2026',
]);

/**
 * Words that make a secret a placeholder wherever they appear in it, as long
 * as they stand on their own: "super_secret_key" is a placeholder, "secretary"
 * is not.
 */
const PLACEHOLDER_WORDS = new Set(['password', 'secret', 'secrets', 'changeme', 'placeholder']);

/** True when the value is an obvious placeholder rather than a real secret. */
function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (PLACEHOLDER_SECRETS.has(normalized)) return true;

  const words = normalized.split(/[^a-z]+/).filter(Boolean);
  if (words.some((word) => PLACEHOLDER_WORDS.has(word))) return true;

  return (
    normalized.includes('changeme') ||
    normalized.includes('change_me') ||
    normalized.includes('change-me') ||
    normalized.includes('super_secure_2026')
  );
}

/**
 * Blank means "not configured": an empty `LOGS_SECRET_KEY=` in a `.env` must
 * behave exactly like an absent one.
 */
const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * A per-process random value. Used where a shared secret is missing outside
 * production: two runs never share one, so the value cannot be guessed from a
 * default that is published in the repository.
 */
function randomSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time comparison for the shared secrets.
 *
 * A length mismatch is a mismatch. `timingSafeEqual` requires buffers of the
 * same length, and hashing first would change the length of the secret, so
 * the comparison is done on the raw bytes.
 */
export function secretMatches(provided: string | undefined | null, expected: string): boolean {
  if (!provided || !expected) return false;

  const given = Buffer.from(provided, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (given.length !== wanted.length) return false;

  return crypto.timingSafeEqual(given, wanted);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters. Generate one with `openssl rand -base64 32`.'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  // The interface the server binds to. `127.0.0.1` keeps a development server
  // off the network; a deployment behind a reverse proxy binds `0.0.0.0`.
  HOST: z.preprocess(blankToUndefined, z.string().trim().min(1).default('127.0.0.1')),
  // `true` trusts every proxy, `false` trusts none, a number trusts that many
  // hops. The default is `false`: trusting `X-Forwarded-For` blindly lets a
  // client spoof its own IP.
  TRUST_PROXY: z
    .string()
    .optional()
    .default('false')
    .transform((val, ctx) => {
      const normalized = val.trim().toLowerCase();
      if (normalized === '' || normalized === 'false' || normalized === '0') return false;
      if (normalized === 'true' || normalized === '1') return true;

      const hops = Number(normalized);
      if (Number.isInteger(hops) && hops > 0) return hops;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TRUST_PROXY must be true, false or a positive hop count',
      });
      return z.NEVER;
    }),
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
  ERROR_LOG_FILE_PATH: z.string().default('./errors.log'),
  // Shared secret for the log endpoints. Required in production; unset
  // elsewhere it becomes a random per-process value, so the endpoints are only
  // reachable with an authenticated super admin.
  LOGS_SECRET_KEY: z.preprocess(blankToUndefined, z.string().trim().optional().default(randomSecret)),
  LOGS_PUBLIC: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),

  // --- Developer Notes & Technical Feedback ---
  // Recipient(s) for the developer notifications. No default: the address is
  // deployment specific and a hard-coded one leaks into every installation.
  DEVELOPER_EMAIL: z.string().default(''),
  // Shared secret for the developer-notes management endpoints. Same rules as
  // LOGS_SECRET_KEY.
  DEVELOPER_NOTES_SECRET: z.preprocess(blankToUndefined, z.string().trim().optional().default(randomSecret)),

  // --- Asynchronous Job Queue (Option C) ---
  // `auto` probes Redis and degrades to inline execution when it is unreachable,
  // so a deployment without Redis still sends mail. `sync` skips the probe
  // entirely; `redis` fails loudly instead of degrading (staging/production).
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  QUEUE_DRIVER: z.enum(['auto', 'redis', 'sync']).default('auto'),
});

/**
 * Production-only hardening.
 *
 * These rules cannot live in the schema because they depend on `NODE_ENV`, and
 * they must stop the boot rather than warn: a production server with a
 * published default secret is exactly the situation this task removes.
 *
 * `rawEnv` is the untouched process environment: the parsed value of a secret
 * that is not set is a random placeholder, so only the raw value can tell
 * "not configured" from "configured with a random-looking string".
 */
export function productionConfigErrors(
  env: { nodeEnv: string; jwtSecret: string },
  rawEnv: Record<string, string | undefined>
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (env.nodeEnv !== 'production') return errors;

  const logsSecret = rawEnv.LOGS_SECRET_KEY?.trim();
  if (!logsSecret) {
    errors.LOGS_SECRET_KEY =
      'LOGS_SECRET_KEY is required in production. Generate one with `openssl rand -base64 32`.';
  } else if (logsSecret.length < MIN_SECRET_LENGTH) {
    errors.LOGS_SECRET_KEY = `LOGS_SECRET_KEY must be at least ${MIN_SECRET_LENGTH} characters.`;
  }

  const developerSecret = rawEnv.DEVELOPER_NOTES_SECRET?.trim();
  if (!developerSecret) {
    errors.DEVELOPER_NOTES_SECRET =
      'DEVELOPER_NOTES_SECRET is required in production. Generate one with `openssl rand -base64 32`.';
  } else if (developerSecret.length < MIN_SECRET_LENGTH) {
    errors.DEVELOPER_NOTES_SECRET = `DEVELOPER_NOTES_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`;
  }

  if (env.jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.JWT_SECRET = `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production.`;
  } else if (isPlaceholderSecret(env.jwtSecret)) {
    errors.JWT_SECRET =
      'JWT_SECRET still holds a placeholder value. Generate one with `openssl rand -base64 32`.';
  }

  return errors;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const env = parsed.data;

const productionErrors = productionConfigErrors(
  { nodeEnv: env.NODE_ENV, jwtSecret: env.JWT_SECRET },
  process.env
);

if (Object.keys(productionErrors).length > 0) {
  console.error('[config] Refusing to start with an insecure production configuration:');
  console.error(JSON.stringify(productionErrors, null, 2));
  process.exit(1);
}

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

// Comma-separated developer notification emails
const developerEmails: string[] = env.DEVELOPER_EMAIL.split(',')
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
  host: env.HOST,
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
  developer: {
    emails: developerEmails,
    secretKey: env.DEVELOPER_NOTES_SECRET,
  },
  queue: {
    redisUrl: env.REDIS_URL,
    driver: env.QUEUE_DRIVER,
  },
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
    errorFilePath: path.resolve(env.ERROR_LOG_FILE_PATH),
    secretKey: env.LOGS_SECRET_KEY,
    isPublic: env.LOGS_PUBLIC,
  },
} as const;

export type Config = typeof config;