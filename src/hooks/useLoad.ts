import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs an async loader on mount/deps change. `reload` re-runs it (e.g. after a write). */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; });
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const result = await loaderRef.current();
      if (id === seq.current) { setData(result); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(e as Error);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, reload };
}
