import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';

import { config } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { attachSockets } from './sockets/index.js';
import { MAX_UPLOAD_BYTES } from './services/mediaService.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { unitRoutes } from './routes/units.routes.js';
import { inquiryRoutes } from './routes/inquiries.routes.js';
import { mediaRoutes } from './routes/media.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true });

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
    return reply.status(500).send({ error: 'Internal server error' });
  });

  // 7. Register API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(unitRoutes, { prefix: '/api/units' });
  await fastify.register(inquiryRoutes, { prefix: '/api/inquiries' });
  await fastify.register(mediaRoutes, { prefix: '/api/media' });

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}