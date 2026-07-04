const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

// Verify JWT and attach user to request
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Support both `userId` (new) and `id` (legacy) JWT payloads
        const userId = decoded.userId || decoded.id;
        if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
        const result = await query(
            'SELECT id, name, email, role, avatar, bio, active, subscription_plan, subscription_expiry, earnings, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (!result.rows.length) {
            console.warn(`[Auth] User ${userId} from token not found in DB`);
            return res.status(401).json({ error: 'User not found' });
        }
        const user = result.rows[0];
        if (!user.active) return res.status(403).json({ error: 'Account suspended' });
        req.user = user;
        next();
    } catch (err) {
        console.error(`[Auth] JWT Verification failed: ${err.message}`);
        if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based access control middleware factory
const authorize = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
}

// Optional auth - attaches user if token present, but doesn't fail if not
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        if (userId) {
            const result = await query(
                'SELECT id, name, email, role, avatar, bio, active FROM users WHERE id = $1',
                [userId]
            );
            if (result.rows.length) req.user = result.rows[0];
        }
    } catch { /* ignore */ }
    next();
};

module.exports = { authenticate, authorize, optionalAuth };
