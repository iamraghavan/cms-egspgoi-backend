const Database = require('better-sqlite3');
const logger = require('../utils/logger');

let cacheDb = null;

const initCache = () => {
    if (cacheDb) return cacheDb;

    try {
        // ':memory:' creates a purely in-memory database.
        // It is synchronously created and extremely fast.
        cacheDb = new Database(':memory:', { verbose: null }); // Set verbose: console.log for debug

        // Create Key-Value Table with JSON support
        // expiry is Unix Timestamp (seconds)
        cacheDb.exec(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value JSON,
                expiry INTEGER
            );
            
            -- Index on expiry for fast cleanup
            CREATE INDEX IF NOT EXISTS idx_expiry ON cache(expiry);
        `);

        logger.info('SQLite In-Memory Cache Initialized');
        return cacheDb;
    } catch (error) {
        logger.error('SQLite Cache Init Failed:', error);
        throw error;
    }
};

const getCacheDb = () => {
    if (!cacheDb) return initCache();
    return cacheDb;
};

module.exports = { initCache, getCacheDb };
