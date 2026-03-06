// Simple in-memory TTL cache for API data
// Prevents re-fetching on back-navigation and page switches

const cache = new Map();
const DEFAULT_TTL = 30000; // 30 seconds

const dataCache = {
  get(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  },

  set(key, data, ttl = DEFAULT_TTL) {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
  },

  invalidate(key) {
    if (key) {
      // Invalidate all keys that start with the prefix
      for (const k of cache.keys()) {
        if (k.startsWith(key)) cache.delete(k);
      }
    } else {
      cache.clear();
    }
  }
};

export default dataCache;
