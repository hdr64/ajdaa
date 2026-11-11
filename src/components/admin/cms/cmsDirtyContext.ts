import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** Lets CMS panels tell the page shell whether they hold unsaved edits. */
export interface CmsDirtyRegistry {
  setDirty: (panel: string, dirty: boolean) => void;
}

export const CmsDirtyContext = createContext<CmsDirtyRegistry | null>(null);

/**
 * Tracks unsaved edits for one CMS panel.
 *
 * The first state after `loading` turns false (initial load, or a refetch after a
 * version rollback) becomes the "saved" snapshot; `dirty` is true while `value`
 * differs from it. Call `markSaved()` after a successful save and use
 * `savedValue()` to restore the last saved state on discard.
 */
export function useCmsDirty<T>(panel: string, value: T, loading: boolean) {
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

/** Hook for the page shell: the provider value plus the set of dirty panels. */
export function useCmsDirtyRegistryState() {
  const [dirtyPanels, setDirtyPanels] = useState<Record<string, boolean>>({});
  const registry = useMemo<CmsDirtyRegistry>(
    () => ({
      setDirty: (panel, dirty) =>
        setDirtyPanels((prev) => (!!prev[panel] === dirty ? prev : { ...prev, [panel]: dirty })),
    }),
    [],
  );
  return { registry, anyDirty: Object.values(dirtyPanels).some(Boolean) };
}
