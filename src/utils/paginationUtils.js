/**
 * Standardize Pagination Parameters
 * @param {object} query - Express req.query object
 * @param {number} defaultLimit - Default items per page (default: 20)
 * @param {number} maxLimit - Maximum items per page (default: 100)
 */
const getPaginationParams = (query, defaultLimit = 20, maxLimit = 100) => {
    let limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    const cursor = query.cursor || null;
    const startDate = query.startDate || null;
    const endDate = query.endDate || null;

    return { limit, cursor, startDate, endDate };
};

/**
 * Format Standard Paginated Response Meta
 * @param {string|null} nextCursor 
 * @param {number} count 
 * @param {number} limit 
 */
const formatPaginationMeta = (nextCursor, count, limit) => {
    return {
        next_cursor: nextCursor,
        count: count,
        limit: limit,
        has_more: !!nextCursor
    };
};

module.exports = { getPaginationParams, formatPaginationMeta };
