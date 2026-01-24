const { Database } = require('@duckdb/node-api');
const path = require('path');
const logger = require('../utils/logger');

let dbInstance = null;

const initDuckDB = async () => {
    if (dbInstance) return dbInstance;

    try {
        const dbPath = path.join(__dirname, '../../analytics.db'); // Root directory
        logger.info(`Initializing DuckDB at ${dbPath}...`);

        dbInstance = await Database.create(dbPath);

        // Initialize Schema
        const conn = await dbInstance.connect();

        // Leads Table (Analytical Schema - Simplified)
        await conn.run(`
            CREATE TABLE IF NOT EXISTS leads_analytics (
                id UUID PRIMARY KEY,
                created_at TIMESTAMP,
                status VARCHAR,
                source VARCHAR,
                college VARCHAR,
                course VARCHAR,
                pipeline_id UUID,
                assigned_to UUID,
                is_deleted BOOLEAN,
                meta JSON
            );
        `);

        // Payments Table
        await conn.run(`
             CREATE TABLE IF NOT EXISTS payments_analytics (
                id UUID PRIMARY KEY,
                date TIMESTAMP,
                amount DOUBLE,
                status VARCHAR,
                campaign_id UUID
             );
        `);

        await conn.close(); // Close this connection, DB instance remains open
        logger.info('DuckDB Initialized Successfully');
        return dbInstance;
    } catch (error) {
        logger.error('DuckDB Initialization Failed:', error);
        throw error;
    }
};

const getDuckDB = async () => {
    if (!dbInstance) {
        return await initDuckDB();
    }
    return dbInstance;
};

module.exports = { initDuckDB, getDuckDB };
