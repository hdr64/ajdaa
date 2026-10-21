import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';

import { config } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { attachSockets } from './sockets/index.js';
import { MAX_UPLOAD_BYTES } from './services/mediaService.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { unitRoutes } from './routes/units.routes.js';
import { inquiryRoutes } from './routes/inquiries.routes.js';
import { mediaRoutes } from './routes/media.routes.js';
import { categoryRoutes } from './routes/categories.routes.js';
import { newsletterRoutes } from './routes/newsletter.routes.js';
import { permissionRoutes } from './routes/permissions.routes.js';
import { roleRoutes } from './routes/roles.routes.js';
import { departmentRoutes } from './routes/departments.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { notificationRoutes } from './routes/notifications.routes.js';
import { cmsRoutes } from './routes/cms.routes.js';
import { logsRoutes } from './routes/logs.routes.js';
import { developerNotesRoutes } from './routes/developerNotes.routes.js';
import { loggerService } from './services/loggerService.js';
import {
  closeQueueService,
  initQueueService,
  queueDriver,
  registerJob,
} from './services/queueService.js';
import { sendDeveloperNoteEmailJob, sendInquiryNotificationJob } from './jobs/emailJobs.js';

/**
 * The path of a URL without its query string.
 *
 * Query parameters are the one part of a URL that routinely carries a secret
 * (`key`, `token`, `otp`, `password`), and they end up in access logs, proxy
 * logs and browser history. Nothing that is logged may contain them.
 */
function stripQuery(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

function requestPath(request: FastifyRequest): string {
  return stripQuery(request.url);
}

/**
 * The serializer for Fastify's own request log.
 *
 * The default one writes the full URL, query string included, which is
 * exactly where a `?key=` or a `?token=` would end up.
 */
export function requestLogSerializer(request: FastifyRequest) {
  const acceptVersion = request.headers?.['accept-version'];

  return {
    method: request.method,
    url: stripQuery(request.url),
    version: typeof acceptVersion === 'string' ? acceptVersion : undefined,
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.raw?.socket?.remotePort,
  };
}

/**
 * Fastify has no hop-count option for `trustProxy`, but its trust function
 * receives the hop index, so "trust the first N hops" is one line. A hop
 * count is the safe choice behind a single reverse proxy: `true` would also
 * trust the `X-Forwarded-For` header of a client that reached the proxy
 * directly.
 */
function trustProxyOption(value: boolean | number): boolean | ((address: string, hop: number) => boolean) {
  if (typeof value === 'number') {
    return (_address, hop) => hop < value;
  }
  return value;
}

export interface BuildAppOptions {
  /**
   * Where the request log is written. The server writes to the standard
   * output; the tests pass a buffer to assert on what was logged.
   */
  loggerStream?: { write(message: string): void };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      stream: options.loggerStream,
      serializers: { req: requestLogSerializer },
    },
    trustProxy: trustProxyOption(config.trustProxy),
  });

  // Rate Limiting (global default off; strict per-route limits configured on endpoints)
  await fastify.register(rateLimit, {
    global: false,
  });

  // 0. Security headers
  // CSP is switched off for now: the API serves JSON, the SPA is served by
  // another origin, and a policy that is not tested against the real front end
  // would break it. Re-enable it once the deployed pages are known.
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    // HSTS is only correct on a real HTTPS deployment; sending it over plain
    // HTTP (or on a bare development host) only breaks the browser.
    hsts: config.isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    // Uploaded images are served from this origin and displayed by the SPA on
    // another one, so they must stay loadable.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // 1. CORS
  await fastify.register(cors, {
    origin: config.clientOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Multipart for File Uploads (up to MAX_UPLOAD_BYTES)
  // throwFileSizeLimit:false lets us answer 413 cleanly instead of tearing down
  // the connection while the client is still writing the body.
  await fastify.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    throwFileSizeLimit: false,
  });

  // 3. JWT Authentication
  // Tokens expire so a leaked one has a bounded lifetime; the client already
  // treats a 401 as a logout.
  await fastify.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '12h' } });
  fastify.decorate('authenticate', authenticate);

  // 4. Static Uploads Serving
  await fastify.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/uploads/',
    // Uploaded files are untrusted content: never let the browser render them
    // inline, and never let them sniff a different type.
    setHeaders(res, filePath) {
      if (filePath.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Disposition', 'attachment');
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  // 5. Socket.io Realtime Engine
  attachSockets(fastify);

  // 6. Translate Prisma's known-request errors into real HTTP status codes so a
  // missing row is a 404 for the client instead of an opaque 500. Must be set
  // before the route plugins register: each plugin captures the handler that
  // exists at registration time.
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    const code = (error as { code?: unknown }).code;

    // Errors raised deliberately by the app (validation, size limits) already
    // carry the correct 4xx code.
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ error: (error as Error).message });
    }

    // A schema `.parse()` inside a handler (e.g. route params) is bad input, not a crash.
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation failed', issues: error.flatten().fieldErrors });
    }

    if (code === 'P2025') {
      return reply.status(404).send({ error: 'Record not found' });
    }
    if (code === 'P2002') {
      return reply.status(409).send({ error: 'A record with these values already exists' });
    }
    if (code === 'P2003') {
      return reply.status(400).send({ error: 'Referenced record does not exist' });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    loggerService.error(
      `Unhandled request error: ${(error as Error).message}`,
      {
        url: requestPath(request),
        method: request.method,
        code,
        stack: (error as Error).stack,
      },
      'http'
    );
    return reply.status(500).send({ error: 'Internal server error' });
  });

  // The default not-found handler logs the raw URL — query string included —
  // and echoes it back to the caller. A request for a URL that carries a key
  // must not put that key in the log or in the response.
  fastify.setNotFoundHandler(async (request, reply) => {
    const path = requestPath(request);

    request.log.warn({ url: path, method: request.method }, 'Route not found');

    return reply.status(404).send({
      message: `Route ${request.method}:${path} not found`,
      error: 'Not Found',
      statusCode: 404,
    });
  });

  // Automatically log incoming HTTP responses to loggerService
  fastify.addHook('onResponse', async (request, reply) => {
    // Avoid noisy recursion from polling the logs endpoint itself
    if (request.url.startsWith('/api/logs')) return;

    const latency = reply.elapsedTime;
    const statusCode = reply.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    // Only the path is logged: the query string may hold a key, a token or a
    // password, and this log ends up in a file that is copied around.
    loggerService.log(
      level,
      `${request.method} ${requestPath(request)} - ${statusCode} (${latency.toFixed(1)}ms)`,
      {
        ip: request.ip,
        statusCode,
        latencyMs: Math.round(latency * 10) / 10,
        userAgent: request.headers['user-agent'],
      },
      'http',
      request.id
    );
  });

  // 7. Register API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(unitRoutes, { prefix: '/api/units' });
  await fastify.register(inquiryRoutes, { prefix: '/api/inquiries' });
  await fastify.register(mediaRoutes, { prefix: '/api/media' });
  await fastify.register(categoryRoutes, { prefix: '/api/categories' });
  await fastify.register(newsletterRoutes, { prefix: '/api/newsletter' });
  await fastify.register(permissionRoutes, { prefix: '/api/permissions' });
  await fastify.register(roleRoutes, { prefix: '/api/roles' });
  await fastify.register(departmentRoutes, { prefix: '/api/departments' });
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  await fastify.register(cmsRoutes, { prefix: '/api/cms' });
  await fastify.register(logsRoutes, { prefix: '/api/logs' });
  await fastify.register(developerNotesRoutes, { prefix: '/api/developer/notes' });

  // The worker runs in-process, so it needs the job handlers before any job can
  // arrive. Registration is cheap and driver-independent.
  registerJob(sendDeveloperNoteEmailJob);
  registerJob(sendInquiryNotificationJob);

  // 8. Job Queue — never fatal. A missing Redis degrades to inline execution so
  // a deployment without Redis still sends mail; `QUEUE_DRIVER=redis` is the
  // opt-in that makes a missing Redis a boot failure.
  await initQueueService();

  // Release the worker, queue and Redis clients on shutdown.
  fastify.addHook('onClose', async () => {
    await closeQueueService();
  });

  // Health check
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      version: '1.2.2',
      queueDriver: queueDriver(),
      timestamp: new Date().toISOString(),
    };
  });

  return fastify;
}