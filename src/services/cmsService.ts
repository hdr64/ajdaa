import { api } from './api';
import { DEFAULT_CMS_CONTENT } from '../types/cms';
import type { CmsClientItem, CmsContent, CmsSectionsPayload } from '../types/cms';

/** Keys the admin can update, matching the server's `SECTION_SCHEMAS`. */
export type CmsSectionKey = 'nav' | 'footer' | 'home' | 'works' | 'clientsPage' | 'contact';

/** Payload of the `cms:updated` socket event. */
export interface CmsUpdatedEvent {
  key: CmsSectionKey;
  version: number;
  timestamp: number;
}

/** Payload of the `cms:clients:updated` socket event. */
export interface CmsClientsUpdatedEvent {
  action: 'create' | 'update' | 'delete' | 'reorder' | 'bulk-delete' | 'bulk-visibility';
  id?: string;
  count?: number;
}

/**
 * Fills in any section the API omitted with the built-in defaults, so one bad
 * section cannot blank the whole site.
 */
function withSectionDefaults(payload: Partial<CmsSectionsPayload>): CmsSectionsPayload {
  return {
    nav: payload.nav?.length ? payload.nav : DEFAULT_CMS_CONTENT.nav,
    footer: payload.footer ?? DEFAULT_CMS_CONTENT.footer,
    home: payload.home ?? DEFAULT_CMS_CONTENT.home,
    works: payload.works ?? DEFAULT_CMS_CONTENT.works,
    clientsPage: payload.clientsPage ?? DEFAULT_CMS_CONTENT.clientsPage,
    contact: payload.contact ?? DEFAULT_CMS_CONTENT.contact,
  };
}

/**
 * Active partners, already sorted by the server.
 *
 * Never throws: this endpoint failing must not take the sections payload down
 * with it, so it falls back to the built-in list.
 */
export async function getCmsClients(signal?: AbortSignal): Promise<CmsClientItem[]> {
  try {
    const clients = await api.get<CmsClientItem[]>('/cms/clients', { signal });
    return clients.length ? clients : DEFAULT_CMS_CONTENT.clients;
  } catch {
    return DEFAULT_CMS_CONTENT.clients;
  }
}

export const cmsService = {
  /**
   * The aggregated, publicly cacheable content payload.
   *
   * Rejects with `ApiError` so callers can report the failure; `CmsProvider` is
   * the layer that decides what to do with it, keeping the last good content
   * rather than overwriting it with defaults.
   */
  async getContent(signal?: AbortSignal): Promise<CmsContent> {
    const [sections, clients] = await Promise.all([
      api.get<Partial<CmsSectionsPayload>>('/cms/content', { signal }),
      getCmsClients(signal),
    ]);

    return { ...withSectionDefaults(sections), clients };
  },

  getClients: getCmsClients,

  /** A single section, used to revalidate just what an admin touched. */
  async getSection<TKey extends CmsSectionKey>(key: TKey, signal?: AbortSignal): Promise<CmsContent[TKey]> {
    const res = await api.get<{ key: string; content: CmsContent[TKey]; version: number } | CmsContent[TKey]>(
      `/cms/content/${key}`,
      { signal }
    );
    if (res && typeof res === 'object' && 'content' in res) {
      return (res as { content: CmsContent[TKey] }).content;
    }
    return res as CmsContent[TKey];
  },
};
