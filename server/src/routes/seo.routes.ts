import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config/env.js';
import { renderPage, renderSitemap, robotsTxt } from '../services/seo/seoService.js';

/**
 * Search-engine facing routes. `/robots.txt` and `/sitemap.xml` live at the site
 * root (Caddy proxies them here); the page shell lives under `/api/seo` and is
 * what Caddy returns for every SPA page URL (see docs/references/architecture.md, "SEO shell").
 */
export const seoRootRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/robots.txt', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=600');
    return reply.type('text/plain; charset=utf-8').send(robotsTxt());
  });

  fastify.get('/sitemap.xml', async (request, reply) => {
    try {
      const xml = await renderSitemap();
      if (!config.seoIndexing) reply.header('X-Robots-Tag', 'noindex, nofollow');
      reply.header('Cache-Control', 'public, max-age=600');
      return reply.type('application/xml; charset=utf-8').send(xml);
    } catch (error) {
      request.log.error({ err: error }, 'sitemap failed');
      return reply.code(503).header('Cache-Control', 'no-store').send();
    }
  });
};

export const seoShellRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { path?: string } }>(
    '/shell',
    { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const page = await renderPage(request.query.path);
        reply.header('Cache-Control', 'no-cache');
        reply.header('ETag', page.etag);
        if (page.robots.startsWith('noindex')) reply.header('X-Robots-Tag', page.robots);
        if (request.headers['if-none-match'] === page.etag) return reply.code(304).send();
        return reply.code(page.status).type('text/html; charset=utf-8').send(page.html);
      } catch (error) {
        // Caddy falls back to the static index.html on a 5xx, so never leak the error.
        request.log.error({ err: error }, 'seo shell failed');
        return reply.code(503).header('Cache-Control', 'no-store').send();
      }
    },
  );
};
