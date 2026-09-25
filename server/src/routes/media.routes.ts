import type { FastifyPluginAsync } from 'fastify';
import { processAndSaveFile, MAX_UPLOAD_BYTES } from '../services/mediaService.js';

// Admin-only route: protects uploads from unauthenticated abuse.
export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/upload',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();

      if (data.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
        return reply.status(413).send({ error: 'File exceeds the 50 MB limit' });
      }

      const stored = await processAndSaveFile(buffer, data.filename);
      return reply.status(201).send(stored);
    }
  );
};
