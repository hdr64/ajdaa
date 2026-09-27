import crypto from 'node:crypto';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/services/prisma.js';

export const SEED_PASSWORD = 'password';

export const SEED_ADMINS = {
  superAdmin: 'admin@ajdaa.sa',
  projectManager: 'f.sudairy@ajdaa.sa',
  salesAgent: 'reem.q@ajdaa.sa',
  viewer: 'turki.d@ajdaa.sa',
} as const;

export interface TestSession {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, boolean>;
  token: string;
}

export interface NewUser {
  name: string;
  email: string;
  password?: string;
  role?: string;
  roleAr?: string;
  permissions?: Record<string, boolean>;
}

let appInstance: FastifyInstance | undefined;

export async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    // `buildApp` hard-codes a verbose pino logger; the suite would drown in it.
    appInstance.log.level = 'silent';
  }
  return appInstance;
}

/** Releases the HTTP server, the socket.io server and the Prisma connection. */
export async function closeApp(): Promise<void> {
  if (!appInstance) return;
  const app = appInstance;
  appInstance = undefined;
  try {
    app.io?.close();
  } catch {
    // socket.io may already have torn the HTTP server down with the app.
  }
  await app.close();
  await prisma.$disconnect();
}

export async function inject(options: InjectOptions): Promise<LightMyRequestResponse> {
  const app = await getApp();
  return app.inject(options);
}

export async function authInject(
  token: string,
  options: InjectOptions
): Promise<LightMyRequestResponse> {
  return inject({
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      authorization: `Bearer ${token}`,
    },
  });
}

const sessionCache = new Map<string, TestSession>();

/** Cached for the seeded accounts, which are never mutated by the suite. */
export async function seedSession(email: string): Promise<TestSession> {
  const cached = sessionCache.get(email);
  if (cached) return cached;
  const session = await login(email, SEED_PASSWORD);
  sessionCache.set(email, session);
  return session;
}

export async function login(email: string, password: string = SEED_PASSWORD): Promise<TestSession> {
  const response = await inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed for ${email}: ${response.statusCode} ${response.body}`);
  }

  const body = response.json() as { token: string; user: Omit<TestSession, 'token'> };
  return { ...body.user, token: body.token };
}

let throwawaySeq = 0;

function uniqueEmail(label: string): string {
  throwawaySeq += 1;
  return `${label}.${Date.now().toString(36)}.${throwawaySeq}.${crypto.randomBytes(3).toString('hex')}@ajdaa.test`;
}

/**
 * Creates an admin through the public API as the seeded super admin, so the
 * record is indistinguishable from one created by hand. Callers are expected to
 * remove it again with `removeUser` so tests stay order-independent.
 */
export async function createThrowawayUser(overrides: Partial<NewUser> = {}): Promise<TestSession> {
  const superAdmin = await seedSession(SEED_ADMINS.superAdmin);
  const password = overrides.password ?? SEED_PASSWORD;
  const payload: NewUser = {
    name: overrides.name ?? 'Throwaway Admin',
    email: overrides.email ?? uniqueEmail('throwaway'),
    password,
    role: overrides.role ?? 'viewer',
    roleAr: overrides.roleAr,
    permissions: overrides.permissions ?? {},
  };

  const response = await authInject(superAdmin.token, {
    method: 'POST',
    url: '/api/auth/users',
    payload,
  });

  if (response.statusCode !== 201) {
    throw new Error(`createThrowawayUser failed: ${response.statusCode} ${response.body}`);
  }

  const created = response.json() as Omit<TestSession, 'token'>;
  return { ...created, token: '' };
}

export async function removeUser(id: string): Promise<void> {
  await prisma.adminUser.deleteMany({ where: { id } });
}

export interface MultipartFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface MultipartBody {
  payload: Buffer;
  headers: Record<string, string>;
}

/**
 * `app.inject()` only accepts a string/object/Buffer/stream payload, so the
 * multipart envelope is assembled by hand rather than relying on FormData.
 */
export function buildMultipartBody(file: MultipartFile): MultipartBody {
  const boundary = `----ajdatest${crypto.randomBytes(12).toString('hex')}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`,
    'utf8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  return {
    payload: Buffer.concat([head, file.data, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

export async function waitFor(
  predicate: () => boolean,
  description: string,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function readJwtTimes(app: FastifyInstance, token: string): { iat: number; exp: number } {
  const payload = app.jwt.decode<{ iat: number; exp: number }>(token);
  if (!payload) throw new Error('Token could not be decoded');
  return { iat: payload.iat, exp: payload.exp };
}
