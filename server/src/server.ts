import { buildApp } from './app.js';
import { config } from './config/env.js';
import { loggerService } from './services/loggerService.js';

const start = async () => {
  const fastify = await buildApp();
  try {
    // The bind address is configurable: `127.0.0.1` by default, so a
    // development server is not reachable from the network. A deployment
    // behind a reverse proxy binds `0.0.0.0`.
    if (config.isProduction && config.trustProxy === false) {
      loggerService.warn(
        'In production with TRUST_PROXY=false, per-IP rate limits and lockouts will see only the proxy address behind Caddy. Set TRUST_PROXY to the number of proxy hops in front of the API.',
        {},
        'config'
      );
    }
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`🚀 Ajda Real Estate API Server running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();