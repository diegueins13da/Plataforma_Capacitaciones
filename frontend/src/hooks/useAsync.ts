import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic hook for async operations with loading / error state.
 *
 * Usage:
 *   const { data, loading, error, execute } = useAsync(() => api.get('/courses/'));
 */
export function useAsync<T>(
  asyncFn?: () => Promise<T>,
  immediate = true
): AsyncState<T> & { execute: () => Promise<void>; reset: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    if (!asyncFn) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await asyncFn();
      if (mountedRef.current) setState({ data, loading: false, error: null });
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message =
          err instanceof Error ? err.message : "Ocurrió un error inesperado.";
        setState({ data: null, loading: false, error: message });
      }
    }
  }, [asyncFn]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  const reset = () => setState({ data: null, loading: false, error: null });

  return { ...state, execute, reset };
}
