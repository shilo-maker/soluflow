/**
 * Simple in-memory caching middleware for API responses
 * Reduces redundant database calls for frequently accessed data
 */

// Simple cache implementation (LRU with TTL)
class SimpleCache {
  constructor(ttl = 300000) { // Default 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    const expiry = Date.now() + this.ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Clear expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Create cache instances with different TTLs
const songCache = new SimpleCache(300000); // 5 minutes for songs
const serviceCache = new SimpleCache(180000); // 3 minutes for services
const userCache = new SimpleCache(600000); // 10 minutes for user data

// Cleanup expired entries every minute
setInterval(() => {
  songCache.cleanup();
  serviceCache.cleanup();
  userCache.cleanup();
}, 60000);

/**
 * Cache middleware factory
 * @param {SimpleCache} cache - Cache instance to use
 * @param {function} keyGenerator - Function to generate cache key from req
 * @returns {function} Express middleware
 */
const cacheMiddleware = (cache, keyGenerator) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = keyGenerator(req);

    // Try to get from cache
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`[Cache HIT] ${key}`);
      return res.json(cachedResponse);
    }

    // Cache miss - continue to route handler
    console.log(`[Cache MISS] ${key}`);

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Only cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data);
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalidate cache for a specific pattern
 * @param {SimpleCache} cache - Cache instance
 * @param {string} pattern - Pattern to match keys (simple string match)
 */
const invalidateCache = (cache, pattern) => {
  const keysToDelete = [];

  for (const key of cache.cache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
  console.log(`[Cache INVALIDATE] Cleared ${keysToDelete.length} keys matching: ${pattern}`);
};

module.exports = {
  songCache,
  serviceCache,
  userCache,
  cacheMiddleware,
  invalidateCache
};
