import { useState, useEffect, useCallback } from 'react';

/**
 * useAsyncData – generic hook for loading async data with loading/error state.
 *
 * Usage:
 *   const { data, loading, error, reload } = useAsyncData(
 *     () => someAPI.getAll(),
 *     []   // dependency array
 *   );
 *
 * @param {function} fetcher   - Async function that returns data
 * @param {any[]} deps         - Dependency array (like useEffect)
 * @param {any} initialData    - Initial value for data (default null)
 * @returns {{ data, loading, error, reload }}
 */
export function useAsyncData(fetcher, deps = [], initialData = null) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetcher();
            setData(result);
        } catch (err) {
            console.error('[useAsyncData] error:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => { load(); }, [load]);

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
 * @param {function[]} fetchers  - Array of async fetcher functions
 * @param {any[]} deps           - Dependency array
 * @returns {{ results: any[], loading: boolean, error: any, reload: function }}
 */
export function useMultipleAsync(fetchers, deps = []) {
    const [results, setResults] = useState(fetchers.map(() => null));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await Promise.all(fetchers.map(fn => fn()));
            setResults(data);
        } catch (err) {
            console.error('[useMultipleAsync] error:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => { load(); }, [load]);

    return { results, loading, error, reload: load };
}
