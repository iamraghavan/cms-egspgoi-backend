// src/utils/AppError.js
// Design Principle: Standardized Error Handling
// Extends built-in Error to include status code and operational flag.

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Trusted error (predictable) vs Bug (unpredictable)

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
