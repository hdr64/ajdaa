import path from 'path';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/prisma.js';
import { SLUG_PATTERN } from '../services/mediaSlugService.js';

/**
 * Permanent public links for library files (no login).
 *
 *  - `GET /f/<slug>`            serves the file itself, whatever its folder or path.
 *  - `GET /html/<slug>/`        serves an HTML page or website; its other files
 *                               (`/html/<slug>/css/app.css`) resolve next to the entry page.
 *
 * The slug is stored on the `MediaFile` row, so the link keeps working when the file
 * is moved between library folders. Pages are sandboxed by the static handler's
 * `Content-Security-Policy` header (see `app.ts`).
 */
export const publicMediaRoutes: FastifyPluginAsync = async (fastify) => {
  async function findBySlug(raw: string) {
    const slug = raw.toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return null;
    return prisma.mediaFile.findUnique({ where: { slug } });
  }

  function notFound(reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
    return reply.status(404).send({ error: 'Not found' });
  }

  fastify.get<{ Params: { slug: string } }>('/f/:slug', async (request, reply) => {
    const media = await findBySlug(request.params.slug);
    if (!media) return notFound(reply);
    // An opaque-origin (sandboxed) page may embed files from here.
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.sendFile(media.storageKey);
  });

  // The trailing slash matters: it makes the page's relative links resolve under /html/<slug>/.
  fastify.get<{ Params: { slug: string } }>('/html/:slug', async (request, reply) => {
    return reply.redirect(`/html/${encodeURIComponent(request.params.slug)}/`, 301);
  });

  fastify.get<{ Params: { slug: string; '*': string } }>('/html/:slug/*', async (request, reply) => {
    const media = await findBySlug(request.params.slug);
    if (!media || media.fileType !== 'html') return notFound(reply);

    const entryDir = path.posix.dirname(media.storageKey); // '.' for a single uploaded page
    const rest = (request.params['*'] ?? '').replace(/^\/+/, '');

    let target: string;
    if (rest === '') {
      target = media.storageKey;
    } else {
      // Only websites extracted from a zip have sibling files to serve.
      if (entryDir === '.') return notFound(reply);
      const segments = rest.split('/');
      if (segments.some((s) => s === '' || s === '..' || s.startsWith('.') || s.includes('\\') || s.includes('\0'))) {
        return notFound(reply);
      }
      target = path.posix.join(entryDir, ...segments);
      if (!target.startsWith(`${entryDir}/`)) return notFound(reply);
    }

    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.sendFile(target);
  });
};
