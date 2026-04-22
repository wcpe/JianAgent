// packages/web/src/hooks/use-loading-state.ts
import { useState, useCallback } from 'react';

interface LoadingState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  execute: (fn: () => Promise<T>) => Promise<void>;
  reset: () => void;
}

export function useLoadingState<T>(): LoadingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset } as const;
}
