require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

const { errorHandler } = require('./middleware/errorHandler');

// Request timeout: abort requests that take > 30s to prevent long-running
// queries from exhausting the connection pool.
const REQUEST_TIMEOUT_MS = 30000;

const requestTimeout = (req, res, next) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
        console.error(`[Timeout] Request ${req.method} ${req.path} exceeded ${REQUEST_TIMEOUT_MS}ms`);
        res.status(503).json({ error: 'Request timed out. Please try again.' });
    });
    next();
};

// Route imports
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const enrollmentsRoutes = require('./routes/enrollments');
const quizzesRoutes = require('./routes/quizzes');
const ratingsRoutes = require('./routes/ratings');
const usersRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const wishlistRoutes = require('./routes/wishlist');
const notificationsRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');
const announcementsRoutes = require('./routes/announcements');
const assignmentsRoutes = require('./routes/assignments');
const departmentsRoutes = require('./routes/departments');
const certificatesRoutes = require('./routes/certificates');
const discussionsRoutes = require('./routes/discussions');
const versionsRoutes = require('./routes/versions');
const attendanceRoutes = require('./routes/attendance');
const notesRoutes = require('./routes/notes');
const bookmarksRoutes = require('./routes/bookmarks');
const gradesRoutes = require('./routes/grades');
const supportRoutes = require('./routes/support');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, mobile apps, etc.)
        if (!origin) return callback(null, true);
        // Allow any localhost port in development
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
        // Allow IP-address origins (server accessed via http://<server-ip> — no domain yet)
        if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(origin)) return callback(null, true);
        // Allow configured FRONTEND_URL in production (also supports a comma-separated list)
        const allowed = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
        if (allowed.length && allowed.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ── Request Timeout ──────────────────────────────────────────────────────────
app.use(requestTimeout);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/discussions', discussionsRoutes);
app.use('/api/courses', versionsRoutes);  // course versioning & drip
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/support', supportRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 LMS Backend running on http://0.0.0.0:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
