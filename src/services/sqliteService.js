const { getCacheDb } = require('../config/sqliteCache');
const logger = require('../utils/logger');

// SET Key-Value with TTL
const set = (key, value, ttlSeconds = 300) => {
    try {
        const db = getCacheDb();
        const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

        // Upsert (INSERT OR REPLACE)
        const stmt = db.prepare('INSERT OR REPLACE INTO cache (key, value, expiry) VALUES (?, ?, ?)');
        const jsonValue = JSON.stringify(value);

        stmt.run(key, jsonValue, expiry);
        return true;
    } catch (error) {
        logger.error('[SQLiteCache] Set Failed:', error);
        return false;
    }
};

// GET Key (lazy expiry check)
const get = (key) => {
    try {
        const db = getCacheDb();
        const now = Math.floor(Date.now() / 1000);

        const stmt = db.prepare('SELECT value, expiry FROM cache WHERE key = ?');
        const row = stmt.get(key);

        if (!row) return null;

        if (row.expiry < now) {
            // Expired: Delete and return null
            db.prepare('DELETE FROM cache WHERE key = ?').run(key);
            return null;
        }

        return JSON.parse(row.value);
    } catch (error) {
        logger.error('[SQLiteCache] Get Failed:', error);
        return null;
    }
};

// DELETE Key
const del = (key) => {
    try {
        const db = getCacheDb();
        db.prepare('DELETE FROM cache WHERE key = ?').run(key);
        return true;
    } catch (error) {
        logger.error('[SQLiteCache] Delete Failed:', error);
        return false;
    }
};

// QUERY inside JSON values (The Superpower!)
// Example: SELECT json_extract(value, '$.role') as role FROM cache
const query = (sql, params = []) => {
    try {
        const db = getCacheDb();
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    } catch (error) {
        logger.error('[SQLiteCache] Query Failed:', error);
        return [];
    }
};

// FLUSH all data
const flush = () => {
    try {
        const db = getCacheDb();
        db.prepare('DELETE FROM cache').run();
        return true;
    } catch (error) {
        logger.error('[SQLiteCache] Flush Failed:', error);
        return false;
    }
};

module.exports = { set, get, del, query, flush };
