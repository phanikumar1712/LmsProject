/**
 * Simple in-memory TTL cache for frequently accessed, slowly-changing data.
 * Reduces repeated DB hits on public stats, category lists, and other
 * read-heavy endpoints without adding Redis infrastructure.
 */

const store = new Map();

const cache = {
    /**
     * Get a cached value. Returns undefined if the key doesn't exist or has expired.
     * @param {string} key
     * @returns {any|undefined}
     */
    get(key) {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    },

    /**
     * Set a cached value with a TTL in seconds.
     * @param {string} key
     * @param {any} value
     * @param {number} ttlSeconds - Time to live in seconds (default 60)
     */
    set(key, value, ttlSeconds = 60) {
        store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    },

    /**
     * Invalidate a specific key.
     * @param {string} key
     */
    invalidate(key) {
        store.delete(key);
    },

    /**
     * Clear all cached entries (useful in tests or after major mutations).
     */
    clear() {
        store.clear();
    },

    /** Number of entries currently in the cache. */
    get size() {
        // Purge expired entries first
        const now = Date.now();
        for (const [key, entry] of store) {
            if (entry.expiresAt && now > entry.expiresAt) store.delete(key);
        }
        return store.size;
    },
};

module.exports = cache;
