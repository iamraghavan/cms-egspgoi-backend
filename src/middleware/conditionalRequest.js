const crypto = require('crypto');

/**
 * Conditional Request Middleware
 * Handles 'If-None-Match' (ETag) and 'If-Modified-Since' headers.
 * 
 * NOTE: Express's built-in 'etag' setting handles generation for simple res.json().
 * This middleware is for finer grained control or non-standard responses if needed.
 * But primarily, we rely on Express's strong ETag generation.
 * This middleware acts as a gatekeeper to skip processing if headers match BEFORE heavy lifting 
 * (if we implemented a way to get hash without fetching data, which is hard in DynamoDB without fetching).
 * 
 * So for now, this ensures we set appropriate Cache-Control headers to encourage clients to use conditions.
 */
const conditionalRequestMiddleware = (req, res, next) => {
    // Ensure clients know they can cache but must revalidate
    // private = only per-user browser cache, no shared CDN (unless we want shared)
    // no-cache = must check with server (etag) before using cached copy
    res.set('Cache-Control', 'private, no-cache');

    // Explicitly allow ETag exposure
    res.set('Access-Control-Expose-Headers', 'ETag');

    next();
};

module.exports = { conditionalRequestMiddleware };
