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

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
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
} as const;

export type Config = typeof config;