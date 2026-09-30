import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  getAggregatedCmsContent,
  getSectionContent,
  updateSectionContent,
  getSectionVersions,
  rollbackSectionVersion,
  getCmsClients,
  createCmsClient,
  updateCmsClient,
  deleteCmsClient,
  reorderCmsClients,
  bulkDeleteCmsClients,
  bulkSetCmsClientsVisibility,
} from '../services/cmsService.js';

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const bulkVisibilitySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  visible: z.boolean(),
});

export const cmsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/cms/content - Aggregated public CMS payload with ETag support
  fastify.get('/content', async (request, reply) => {
    const { payload, etag } = await getAggregatedCmsContent();

    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    reply.header('ETag', etag);

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return payload;
  });

  // 2. GET /api/cms/content/:key - Single section content
  fastify.get<{ Params: { key: string } }>('/content/:key', async (request, reply) => {
    const section = await getSectionContent(request.params.key);
    if (!section) {
      return reply.status(404).send({ error: `Section ${request.params.key} not found` });
    }

    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    reply.header('ETag', section.etag);

    if (request.headers['if-none-match'] === section.etag) {
      return reply.status(304).send();
    }

    return section.data;
  });

  // 3. PUT /api/cms/content/:key - Admin updates a section
  fastify.put<{ Params: { key: string } }>(
    '/content/:key',
    {
      onRequest: [authenticate, requirePermission('manageCms')],
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      try {
        const result = await updateSectionContent(
          request.params.key,
          request.body,
          request.admin!.id,
          fastify.io
        );
        return result;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // 4. GET /api/cms/content/:key/versions - Version history list
  fastify.get<{ Params: { key: string } }>(
    '/content/:key/versions',
    { onRequest: [authenticate, requirePermission('manageCms')] },
    async (request) => {
      return getSectionVersions(request.params.key);
    }
  );

  // 5. POST /api/cms/content/:key/rollback/:version - Rollback to prior version
  fastify.post<{ Params: { key: string; version: string } }>(
    '/content/:key/rollback/:version',
    {
      onRequest: [authenticate, requirePermission('rollbackCms')],
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      const versionNum = parseInt(request.params.version, 10);
      if (isNaN(versionNum) || versionNum < 1) {
        return reply.status(400).send({ error: 'Invalid version number' });
      }
      try {
        const restored = await rollbackSectionVersion(
          request.params.key,
          versionNum,
          request.admin!.id,
          fastify.io
        );
        return restored;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // 6. GET /api/cms/clients - Public clients list
  fastify.get('/clients', async () => {
    return getCmsClients(true);
  });

  // 7. GET /api/cms/clients/all - Admin clients list (including hidden)
  fastify.get(
    '/clients/all',
    { onRequest: [authenticate, requirePermission('manageClients')] },
    async () => {
      return getCmsClients(false);
    }
  );

  // 8. POST /api/cms/clients - Admin creates a partner
  fastify.post(
    '/clients',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      try {
        const client = await createCmsClient(request.body, fastify.io);
        return reply.status(201).send(client);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // 9. PUT /api/cms/clients/:id - Admin updates a partner
  fastify.put<{ Params: { id: string } }>(
    '/clients/:id',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      try {
        const client = await updateCmsClient(request.params.id, request.body, fastify.io);
        return client;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // 10. DELETE /api/cms/clients/:id - Admin deletes a partner
  fastify.delete<{ Params: { id: string } }>(
    '/clients/:id',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      try {
        const deleted = await deleteCmsClient(request.params.id, fastify.io);
        return deleted;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // 11. PUT /api/cms/clients/reorder - Reorder partners
  fastify.put(
    '/clients/reorder',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      preValidation: [validateBody(reorderSchema)],
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request) => {
      const { orderedIds } = reorderSchema.parse(request.body);
      return reorderCmsClients(orderedIds, fastify.io);
    }
  );

  // 12. DELETE /api/cms/clients/bulk - Bulk delete partners
  fastify.delete(
    '/clients/bulk',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      preValidation: [validateBody(bulkIdsSchema)],
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
    },
    async (request) => {
      const { ids } = bulkIdsSchema.parse(request.body);
      return bulkDeleteCmsClients(ids, fastify.io);
    }
  );

  // 13. PATCH /api/cms/clients/bulk-visibility - Bulk visibility toggle
  fastify.patch(
    '/clients/bulk-visibility',
    {
      onRequest: [authenticate, requirePermission('manageClients')],
      preValidation: [validateBody(bulkVisibilitySchema)],
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
    },
    async (request) => {
      const { ids, visible } = bulkVisibilitySchema.parse(request.body);
      return bulkSetCmsClientsVisibility(ids, visible, fastify.io);
    }
  );
};
