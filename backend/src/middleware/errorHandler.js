// Wrap async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler
const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);

    // PostgreSQL unique violation
    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists', detail: err.detail });
    }
    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid reference', detail: err.detail });
    }
    // PostgreSQL check violation
    if (err.code === '23514') {
        return res.status(400).json({ error: 'Validation failed', detail: err.detail });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

// Create custom HTTP errors
const createError = (message, statusCode) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

module.exports = { asyncHandler, errorHandler, createError };
