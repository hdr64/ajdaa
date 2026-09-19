import type { FastifyPluginAsync } from 'fastify';
import { processAndSaveFile } from '../services/mediaService.js';

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const result = await processAndSaveFile(buffer, data.filename, data.mimetype);

    return result;
  });
};
