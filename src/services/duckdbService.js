const { getDuckDB } = require('../config/duckdb');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const insertLead = async (lead) => {
    try {
        const db = await getDuckDB();
        const conn = await db.connect();

        const stmt = await conn.prepare(`
            INSERT INTO leads_analytics (
                id, created_at, status, source, college, course, pipeline_id, assigned_to, is_deleted, meta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::JSON);
        `);

        await stmt.run(
            lead.id || uuidv4(),
            lead.created_at || new Date().toISOString(),
            lead.status || 'new',
            lead.source_website || 'unknown',
            lead.college || null,
            lead.course || null,
            lead.pipeline_id || null,
            lead.assigned_to || null,
            lead.is_deleted || false,
            JSON.stringify(lead.utm_params || {})
        );

        await stmt.finalize(); // Clean up statement
        await conn.close();    // Return connection to pool logic (if implemented) or just close
    } catch (error) {
        // Log but don't crash main flow (Fail-safe)
        logger.error('[DuckDB] Insert Lead Failed', error);
    }
};

const getAnalytics = async () => {
    try {
        const db = await getDuckDB();
        const conn = await db.connect();

        // Example: Ultra-fast aggregation query
        const result = await conn.run(`
            SELECT 
                status, 
                COUNT(*) as count,
                strftime(created_at, '%Y-%m-%d') as day
            FROM leads_analytics
            GROUP BY status, day
            ORDER BY day DESC;
        `);

        // Read chunks (Native Arrow format or simple iterator)
        // For @duckdb/node-api, .run() returns a Result object which is async iterable or has fetchAll
        const rows = await result.getRows();

        await conn.close();
        return rows;
    } catch (error) {
        logger.error('[DuckDB] Analytics Query Failed', error);
        return [];
    }
};

module.exports = { insertLead, getAnalytics };
