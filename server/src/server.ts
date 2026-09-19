import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { unitRoutes } from './routes/units.routes.js';
import { inquiryRoutes } from './routes/inquiries.routes.js';
import { mediaRoutes } from './routes/media.routes.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

const fastify = Fastify({
  logger: true
});

// 1. CORS
await fastify.register(cors, {
  origin: [CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

// 2. Multipart for File Uploads (up to 50MB)
await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

// 3. JWT Authentication
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'ajda_secret_development_key_super_secure_2026'
});

fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
  }
});

// 4. Static Uploads Serving
await fastify.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: '/uploads/'
});

// 5. Socket.io Realtime Engine
const io = new SocketIOServer(fastify.server, {
  cors: {
    origin: [CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

(fastify as any).io = io;

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

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

// 7. Start Server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Ajda Real Estate API Server running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
