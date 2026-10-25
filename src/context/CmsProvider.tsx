import { useCallback, useEffect, useRef, useState } from 'react';
import { CmsContext } from './cmsContextDef';
import { cmsService } from '../services/cmsService';
import { acquireSocket, releaseSocket } from '../services/realtimeSocket';
import { getErrorMessage } from '../services/api';
import { DEFAULT_CMS_CONTENT } from '../types/cms';
import type { CmsContent } from '../types/cms';

/** Bumped when the payload shape changes, so an old cache is ignored, not trusted. */
const CACHE_KEY = 'ajda_cms_cache_v2';

/** Admin saves can fire several socket events in a row; collapse them into one refetch. */
const REVALIDATE_DEBOUNCE_MS = 250;

interface CmsCacheEnvelope {
  content: CmsContent;
}

/**
 * Reads the last known content so the first paint is instant. Anything that
 * does not look like a usable payload is discarded rather than trusted.
 */
function readCache(): CmsContent {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_CMS_CONTENT;

    const parsed = JSON.parse(raw) as Partial<CmsCacheEnvelope>;
    const content = parsed?.content;
    if (!content || typeof content !== 'object') return DEFAULT_CMS_CONTENT;
    if (!Array.isArray(content.nav) || !content.footer || !content.home) return DEFAULT_CMS_CONTENT;

    return content as CmsContent;
  } catch {
    // Unavailable (private mode) or corrupt: the built-in defaults are fine.
    return DEFAULT_CMS_CONTENT;
  }
}

function writeCache(content: CmsContent): void {
  try {
    const envelope: CmsCacheEnvelope = { content };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Over quota or storage disabled: caching is an optimisation, not a requirement.
  }
}

/**
 * Serves the whole public site from one database-backed payload.
 *
 * Three tiers: the cached copy paints immediately, a background fetch
 * revalidates it (stale-while-revalidate), and the admin's socket events push
 * fresh content without a reload. A failed revalidation never clears the page —
 * it only records the error, so the last good content stays on screen.
 */
export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<CmsContent>(readCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const revalidate = useCallback(async () => {
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    try {
      const next = await cmsService.getContent(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;

      setContent((current) => {
        // Skip the state update (and the re-render of every consumer) when the
        // payload is byte-identical, which is the common case on revalidation.
        if (JSON.stringify(current) === JSON.stringify(next)) return current;
        return next;
      });
      writeCache(next);
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(getErrorMessage(caught));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void revalidate();

    return () => {
      mountedRef.current = false;
      inFlightRef.current?.abort();
    };
  }, [revalidate]);

  useEffect(() => {
    const socket = acquireSocket();

    const scheduleRevalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void revalidate();
      }, REVALIDATE_DEBOUNCE_MS);
    };

    // Reconnects mean we may have missed updates while the socket was down.
    socket.on('connect', scheduleRevalidate);
    socket.on('cms:updated', scheduleRevalidate);
    socket.on('cms:clients:updated', scheduleRevalidate);

    return () => {
      socket.off('connect', scheduleRevalidate);
      socket.off('cms:updated', scheduleRevalidate);
      socket.off('cms:clients:updated', scheduleRevalidate);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      releaseSocket();
    };
  }, [revalidate]);

  return (
    <CmsContext.Provider value={{ content, loading, error, reload: revalidate }}>
      {children}
    </CmsContext.Provider>
  );
}
