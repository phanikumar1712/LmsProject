require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const { errorHandler } = require('./middleware/errorHandler');

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
const subscriptionsRoutes = require('./routes/subscriptions');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, mobile apps, etc.)
        if (!origin) return callback(null, true);
        // Allow any localhost port in development
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        // Allow configured FRONTEND_URL in production
        const allowed = process.env.FRONTEND_URL;
        if (allowed && origin === allowed) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

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
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/upload', uploadRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 LMS Backend running on http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
