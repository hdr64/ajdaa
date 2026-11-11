import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeDrafts, type PreviewDrafts } from '../../../utils/cmsPreviewProtocol';

/** Lets CMS panels tell the page shell whether they hold unsaved edits. */
export interface CmsDirtyRegistry {
  setDirty: (panel: string, dirty: boolean) => void;
  /** Publishes a panel's unsaved content (JSON) to the live preview; `null` withdraws it. */
  setDraft: (panel: string, json: string | null) => void;
}

export const CmsDirtyContext = createContext<CmsDirtyRegistry | null>(null);

/**
 * Tracks unsaved edits for one CMS panel.
 *
 * The first state after `loading` turns false (initial load, or a refetch after a
 * version rollback) becomes the "saved" snapshot; `dirty` is true while `value`
 * differs from it. Call `markSaved()` after a successful save and use
 * `savedValue()` to restore the last saved state on discard.
 *
 * With `toDraft`, the panel also publishes its unsaved content to the live
 * preview while dirty. `toDraft` must be pure; it runs on every render while dirty.
 */
export function useCmsDirty<T>(
  panel: string,
  value: T,
  loading: boolean,
  toDraft?: (value: T) => unknown,
) {
  const [snapshot, setSnapshot] = useState<string | null>(null);

  // Adjusting state during render (React-approved) avoids an effect-driven extra pass.
  if (loading && snapshot !== null) setSnapshot(null);
  else if (!loading && snapshot === null) setSnapshot(JSON.stringify(value));

  const dirty = snapshot !== null && JSON.stringify(value) !== snapshot;
  const registry = useContext(CmsDirtyContext);

  useEffect(() => {
    registry?.setDirty(panel, dirty);
    return () => registry?.setDirty(panel, false);
  }, [registry, panel, dirty]);

  // Compared by string on purpose: a panel may hand over a fresh object every
  // render, and only a real content change should reach the page shell.
  const publishesDraft = toDraft !== undefined;
  const draftJson = publishesDraft && dirty ? JSON.stringify(toDraft(value)) ?? null : null;

  useEffect(() => {
    if (!publishesDraft) return;
    registry?.setDraft(panel, draftJson);
    return () => registry?.setDraft(panel, null);
  }, [registry, panel, publishesDraft, draftJson]);

  // Closing or reloading the tab with unsaved edits triggers the browser prompt.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    dirty,
    markSaved: (saved: T = value) => setSnapshot(JSON.stringify(saved)),
    savedValue: (): T | null => (snapshot === null ? null : (JSON.parse(snapshot) as T)),
  };
}

/** Hook for the page shell: the provider value, the dirty flag, and the drafts to preview. */
export function useCmsDirtyRegistryState() {
  const [dirtyPanels, setDirtyPanels] = useState<Record<string, boolean>>({});
  const [draftJsons, setDraftJsons] = useState<Record<string, string>>({});
  const registry = useMemo<CmsDirtyRegistry>(
    () => ({
      setDirty: (panel, dirty) =>
        setDirtyPanels((prev) => (!!prev[panel] === dirty ? prev : { ...prev, [panel]: dirty })),
      setDraft: (panel, json) =>
        setDraftJsons((prev) => {
          if (json === null) {
            if (!(panel in prev)) return prev;
            const rest = { ...prev };
            delete rest[panel];
            return rest;
          }
          return prev[panel] === json ? prev : { ...prev, [panel]: json };
        }),
    }),
    [],
  );

  const drafts = useMemo<PreviewDrafts>(() => {
    const parsed: Record<string, unknown> = {};
    for (const [panel, json] of Object.entries(draftJsons)) {
      try {
        parsed[panel] = JSON.parse(json);
      } catch {
        // A malformed draft is skipped; the preview keeps showing saved content.
      }
    }
    return sanitizeDrafts(parsed);
  }, [draftJsons]);

  return { registry, anyDirty: Object.values(dirtyPanels).some(Boolean), drafts };
}
