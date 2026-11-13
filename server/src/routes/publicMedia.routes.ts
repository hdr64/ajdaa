import fs from 'fs/promises';
import path from 'path';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/prisma.js';
import { SLUG_PATTERN } from '../services/mediaSlugService.js';
import { config } from '../config/env.js';

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
/**
 * Reports the page's own location to the admin "pick a page" dialog that frames it.
 * The page runs sandboxed (opaque origin), so the parent cannot read its URL: the
 * page has to tell it. Only runs when framed, and sends nothing a visitor could not see.
 */
const CAPTURE_SCRIPT = `<script>(function(){if(window.parent===window)return;function s(){try{window.parent.postMessage({type:'ajda-capture-nav',path:location.pathname,search:location.search,hash:location.hash},'*')}catch(e){}}s();window.addEventListener('hashchange',s);window.addEventListener('popstate',s);['pushState','replaceState'].forEach(function(k){var o=history[k];history[k]=function(){var r=o.apply(this,arguments);s();return r}})})();</script>`;

const MAX_PREVIEW_HTML_BYTES = 5 * 1024 * 1024;

export function injectCaptureScript(html: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + CAPTURE_SCRIPT + html.slice(head.index + head[0].length);
  return CAPTURE_SCRIPT + html;
}

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

  /**
   * `GET /api/media/site-preview/<path under /uploads/>`: the same files as `/uploads/`, but HTML pages
   * get a small script that reports the page's location to the framing admin dialog, so the admin can
   * click through an extracted site and capture the page they want. It lives under `/api/` because the
   * reverse proxy already forwards that prefix. Links inside the site stay under this prefix, so the
   * script runs on every page the admin navigates to.
   */
  fastify.get<{ Params: { '*': string } }>('/api/media/site-preview/*', async (request, reply) => {
    const rest = (request.params['*'] ?? '').replace(/^\/+/, '');
    const segments = rest.split('/');
    if (
      rest === '' ||
      segments.some((s, i) => (s === '' && i !== segments.length - 1) || s === '..' || s.startsWith('.') || s.includes('\\') || s.includes('\0'))
    ) {
      return notFound(reply);
    }

    const absolute = path.resolve(config.uploadDir, ...segments);
    if (!absolute.startsWith(`${path.resolve(config.uploadDir)}${path.sep}`)) return notFound(reply);

    let stat;
    try {
      stat = await fs.stat(absolute);
    } catch {
      return notFound(reply);
    }
    if (stat.isDirectory()) {
      // Relative links of a directory page only resolve with a trailing slash.
      if (!rest.endsWith('/')) return reply.redirect(`${request.url.split('?')[0]}/${request.url.includes('?') ? `?${request.url.split('?').slice(1).join('?')}` : ''}`, 301);
      segments.pop();
      segments.push('index.html');
    }
    const relative = segments.filter(Boolean).join('/');
    const isHtml = /\.html?$/i.test(relative);

    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
    if (!isHtml) return reply.sendFile(relative);

    const file = path.resolve(config.uploadDir, relative);
    let size: number;
    try {
      size = (await fs.stat(file)).size;
    } catch {
      return notFound(reply);
    }
    if (size > MAX_PREVIEW_HTML_BYTES) return reply.sendFile(relative);
    const html = await fs.readFile(file, 'utf8');
    reply.removeHeader('X-Frame-Options');
    reply.header('Content-Security-Policy', 'sandbox allow-scripts allow-popups allow-forms');
    return reply.type('text/html; charset=utf-8').send(injectCaptureScript(html));
  });
};
