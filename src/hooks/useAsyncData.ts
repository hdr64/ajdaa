import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../services/api';

export interface AsyncResource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Runs an async loader on mount and whenever `deps` change, tracking
 * loading/error state and discarding results from superseded requests.
 */
export function useAsyncData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  initialData: T
): AsyncResource<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current(controller.signal);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setData(result);
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(getErrorMessage(caught));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void run();
    return () => {
      // Bump the id so an in-flight response for this dep set is ignored.
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}
