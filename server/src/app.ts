import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';

import { config } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { attachSockets } from './sockets/index.js';
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

  // 2. Multipart for File Uploads (up to 50MB)
  await fastify.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // 3. JWT Authentication
  await fastify.register(jwt, { secret: config.jwtSecret });
  fastify.decorate('authenticate', authenticate);

  // 4. Static Uploads Serving
  await fastify.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/uploads/',
  });

  // 5. Socket.io Realtime Engine
  attachSockets(fastify);

  // 6. Register API Routes
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