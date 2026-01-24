// src/utils/asyncHandler.js
// Design Principle: DRY (Don't Repeat Yourself) / Error Handling
// Wraps async functions to automatically catch errors and pass them to the global error handler.

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
