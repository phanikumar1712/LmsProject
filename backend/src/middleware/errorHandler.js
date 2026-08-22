// Wrap async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    // Client errors (4xx) are expected outcomes — validation failures, auth
    // denials, department-scope 403s, missing resources. Log them as a one-line
    // WARN so security denials don't spam the log with stack traces. Only real
    // server errors (5xx) get the full ERROR + stack.
    if (statusCode >= 500) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err);
    } else {
        console.warn(`[WARN] ${req.method} ${req.path} -> ${statusCode}: ${err.message}`);
    }

    // PostgreSQL invalid input syntax (e.g. invalid UUID)
    if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data format provided' });
    }
    // PostgreSQL unique violation
    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists' });
    }
    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid reference' });
    }
    // PostgreSQL check violation
    if (err.code === '23514') {
        return res.status(400).json({ error: 'Validation failed' });
    }

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
