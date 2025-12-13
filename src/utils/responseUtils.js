const logger = require('./logger');

const sendSuccess = (res, data, message = 'Success', statusCode = 200, meta = {}) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        meta // Pagination info, etc.
    });
};

const sendError = (res, error, context = 'Operation', statusCode = 500) => {
    logger.error(`${context} Error:`, error);
    
    // Determine status code based on error type if not explicitly provided
    let finalStatusCode = statusCode;
    if (error.name === 'ValidationError') finalStatusCode = 400;
    if (error.name === 'UnauthorizedError') finalStatusCode = 401;
    if (error.name === 'ForbiddenError') finalStatusCode = 403;

    res.status(finalStatusCode).json({
        success: false,
        message: error.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
};

module.exports = { sendSuccess, sendError };
