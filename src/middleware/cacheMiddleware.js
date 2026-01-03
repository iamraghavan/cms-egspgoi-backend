const NodeCache = require('node-cache');

// Std TTL: 5 minutes (300s), Check period: 10 minutes (600s)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Higher-order function for caching
 * @param {number} durationSeconds - Cache duration for this specific route
 */
const cacheMiddleware = (durationSeconds = 300) => (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }

    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
        // Cache Hit
        return res.status(200).json(cachedResponse);
    } else {
        // Cache Miss - Default res.json methods don't let us read the body easily to cache it.
        // We override res.json to capture the response.
        const originalJson = res.json;

        res.json = (body) => {
            // Restore original json function to avoid infinite loop or weirdness
            res.json = originalJson;

            // Cache the body if successful response
            if (res.statusCode === 200) {
                // Use custom duration if provided, otherwise default buffer
                cache.set(key, body, durationSeconds);
            }

            // Send response
            return res.json(body);
        };
        next();
    }
};

/**
 * Utility to clear cache keys by pattern (e.g. invalidating 'leads' when a new lead is added)
 * @param {string} keyPattern 
 */
const clearCache = (keyPattern) => {
    const keys = cache.keys();
    const matches = keys.filter(k => k.includes(keyPattern));
    if (matches.length > 0) {
        cache.del(matches);
        console.log(`Cache cleared for keys: ${matches.join(', ')}`);
    }
};

module.exports = { cacheMiddleware, clearCache };
