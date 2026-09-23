import { buildApp } from './app.js';
import { config } from './config/env.js';

const start = async () => {
  const fastify = await buildApp();
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`🚀 Ajda Real Estate API Server running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();