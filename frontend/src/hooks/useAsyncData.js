import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAsyncData – generic hook for loading async data with loading/error state.
 *
 * Usage:
 *   const { data, loading, error, reload } = useAsyncData(
 *     () => someAPI.getAll(),
 *     []   // dependency array
 *   );
 *
 * Abort handling: each load creates its own AbortController. Starting a new
 * load (deps changed or reload()) aborts the previous in-flight request, and
 * unmounting the component aborts it too — so stale responses never overwrite
 * newer data and state is never set after unmount. The signal is passed to the
 * fetcher so fetchers that support cancellation (e.g. import APIs) can abort
 * the actual network request.
 *
 * @param {function} fetcher   - Async function that returns data (receives an AbortSignal)
 * @param {any[]} deps         - Dependency array (like useEffect)
 * @param {any} initialData    - Initial value for data (default null)
 * @returns {{ data, loading, error, reload }}
 */
export function useAsyncData(fetcher, deps = [], initialData = null) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const controllerRef = useRef(null);

    const load = useCallback(async () => {
        // Cancel any previous in-flight request first (deps changed or reload).
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const signal = controller.signal;

        setLoading(true);
        setError(null);
        try {
            const result = await fetcher(signal);
            if (!signal.aborted) setData(result);
        } catch (err) {
            // Aborted loads (unmount / superseded / timeout) are silent.
            if (signal.aborted) return;
            console.error('[useAsyncData] error:', err);
            setError(err);
        } finally {
            if (!signal.aborted) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    }, deps);

    useEffect(() => {
        load();
        return () => controllerRef.current?.abort();
    }, [load]);

    return { data, loading, error, reload: load };
}

/**
 * useMultipleAsync – loads multiple async operations in parallel.
 *
 * Usage:
 *   const { results, loading } = useMultipleAsync([
 *     () => statsAPI.getInstructor(userId),
 *     () => coursesAPI.getByInstructor(userId),
 *   ], [userId]);
 *
 * Abort handling mirrors useAsyncData: a new load aborts the previous one and
 * unmounting aborts in-flight requests, preventing stale writes and
 * setState-after-unmount.
 *
 * @param {function[]} fetchers  - Array of async fetcher functions (each receives an AbortSignal)
 * @param {any[]} deps           - Dependency array
 * @returns {{ results: any[], loading: boolean, error: any, reload: function }}
 */
export function useMultipleAsync(fetchers, deps = []) {
    const [results, setResults] = useState(fetchers.map(() => null));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const controllerRef = useRef(null);

    const load = useCallback(async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const signal = controller.signal;

        setLoading(true);
        setError(null);
        try {
            const data = await Promise.all(fetchers.map(fn => fn(signal)));
            if (!signal.aborted) setResults(data);
        } catch (err) {
            if (signal.aborted) return;
            console.error('[useMultipleAsync] error:', err);
            setError(err);
        } finally {
            if (!signal.aborted) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    }, deps);

    useEffect(() => {
        load();
        return () => controllerRef.current?.abort();
    }, [load]);

    return { results, loading, error, reload: load };
}
