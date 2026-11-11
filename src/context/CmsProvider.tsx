import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CmsContext } from './cmsContextDef';
import { cmsService } from '../services/cmsService';
import { acquireSocket, releaseSocket } from '../services/realtimeSocket';
import { getErrorMessage } from '../services/api';
import { DEFAULT_CMS_CONTENT } from '../types/cms';
import type { CmsContent } from '../types/cms';
import {
  PREVIEW_DRAFT_KEYS,
  isPreviewFrame,
  isTrustedParentMessage,
  postToParent,
  sanitizeDrafts,
  type PreviewDrafts,
} from '../utils/cmsPreviewProtocol';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Overlays unsaved drafts on the saved content. With no drafts the saved object
 * itself is returned. Object sections merge one level deep so a field missing
 * from the draft falls back to its saved value; arrays and type mismatches use
 * the draft as is.
 */
function mergeDrafts(server: CmsContent, drafts: PreviewDrafts): CmsContent {
  const keys = PREVIEW_DRAFT_KEYS.filter((key) => drafts[key] !== undefined);
  if (keys.length === 0) return server;

  const merged: Record<string, unknown> = { ...server };
  for (const key of keys) {
    const savedSection: unknown = server[key];
    const draftSection: unknown = drafts[key];
    merged[key] =
      isPlainObject(savedSection) && isPlainObject(draftSection)
        ? { ...savedSection, ...draftSection }
        : draftSection;
  }
  return merged as unknown as CmsContent;
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
  const [drafts, setDrafts] = useState<PreviewDrafts>({});
  const [epoch, setEpoch] = useState(0);

  const draftsRef = useRef<PreviewDrafts>({});
  /** Identifies the latest draft message, so a slow release never overwrites a newer one. */
  const draftSeqRef = useRef(0);
  const readySentRef = useRef(false);
  const latestRevalidateRef = useRef<Promise<void> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchContent = useCallback(async () => {
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
      writeCache(next); // server data only, never the merged draft content
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(getErrorMessage(caught));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const revalidate = useCallback(() => {
    const run = fetchContent();
    latestRevalidateRef.current = run;
    return run;
  }, [fetchContent]);

  const applyDrafts = useCallback((next: PreviewDrafts) => {
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const rejectDrafts = useCallback(() => {
    draftSeqRef.current += 1;
    applyDrafts({});
    setEpoch((e) => e + 1);
    postToParent({ type: 'AJDA_PREVIEW_ERROR' });
  }, [applyDrafts]);

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

    const handleDraftMessage = async (rawDrafts: unknown) => {
      const next = sanitizeDrafts(rawDrafts);
      const seq = ++draftSeqRef.current;
      const current = draftsRef.current;

      // Sections that were previewed and no longer are (saved or discarded) keep
      // showing their draft until the refetch lands, so the old text never flashes.
      const heldOver: Record<string, unknown> = {};
      for (const key of PREVIEW_DRAFT_KEYS) {
        if (current[key] !== undefined && next[key] === undefined) heldOver[key] = current[key];
      }

      if (Object.keys(heldOver).length === 0) {
        applyDrafts(next);
        return;
      }

      applyDrafts({ ...next, ...heldOver } as PreviewDrafts);
      // Wait for the newest refetch too: a socket event may supersede ours mid-flight.
      let pending = revalidate();
      await pending;
      while (mountedRef.current && latestRevalidateRef.current && latestRevalidateRef.current !== pending) {
        pending = latestRevalidateRef.current;
        await pending;
      }
      if (mountedRef.current && seq === draftSeqRef.current) applyDrafts(next);
    };

    // Messages from the admin tab when this page runs inside the live-preview iframe.
    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedParentMessage(event)) return;
      const data: unknown = event.data;
      if (typeof data !== 'object' || data === null) return;
      const message = data as { type?: unknown; drafts?: unknown };
      if (message.type === 'AJDA_CMS_UPDATED') {
        scheduleRevalidate();
      } else if (message.type === 'AJDA_CMS_DRAFT') {
        void handleDraftMessage(message.drafts);
      }
    };
    window.addEventListener('message', handleMessage);

    if (isPreviewFrame() && !readySentRef.current) {
      readySentRef.current = true;
      postToParent({ type: 'AJDA_PREVIEW_READY' });
    }

    return () => {
      socket.off('connect', scheduleRevalidate);
      socket.off('cms:updated', scheduleRevalidate);
      socket.off('cms:clients:updated', scheduleRevalidate);
      window.removeEventListener('message', handleMessage);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      releaseSocket();
    };
  }, [revalidate, applyDrafts]);

  const mergedContent = useMemo(() => mergeDrafts(content, drafts), [content, drafts]);

  const preview = useMemo(
    () => ({
      active: isPreviewFrame(),
      hasDrafts: Object.keys(drafts).length > 0,
      epoch,
      rejectDrafts,
    }),
    [drafts, epoch, rejectDrafts],
  );

  const value = useMemo(
    () => ({ content: mergedContent, loading, error, reload: revalidate, preview }),
    [mergedContent, loading, error, revalidate, preview],
  );

  return (
    <CmsContext.Provider value={value}>
      {children}
    </CmsContext.Provider>
  );
}
