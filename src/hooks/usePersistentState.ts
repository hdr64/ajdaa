import { useCallback, useState } from 'react';

/**
 * useState that remembers its value in localStorage, for per-viewer UI
 * preferences only (layout, grid columns, panel width). Storage can be missing
 * or throw (private mode, blocked site data), so every access is guarded and the
 * default is used instead. `isValid` rejects stale or tampered values.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T = (value): value is T => typeof value === typeof defaultValue
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback(
    (value: T) => {
      setState(value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Preference just won't persist.
      }
    },
    [key]
  );

  return [state, update];
}
