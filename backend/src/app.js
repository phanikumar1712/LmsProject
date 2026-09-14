// Load backend/.env by path so the app behaves the same whether started from
// backend/ (npm start) or bundled from the repo root (Vercel function).
// override is FALSE (dotenv default): real environment variables (platform-
// injected PORT, DATABASE_URL, …) always win over file values — the file only
// fills gaps for local development. This keeps Railway/Vercel/Docker env
// authoritative and prevents a stray .env from breaking platform config.
require('dotenv').config({
    path: require('path').join(__dirname, '..', '.env'),
    override: false,
});
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

// ── Security & Parsing ────────────────────────────────────────────────────────
// Helmet defaults, with only img-src widened: course thumbnails and media live
// on Cloudinary (res.cloudinary.com) and placeholder imagery on Unsplash, so
// the default "img-src 'self' data:" makes Chrome block those images. Every
// other CSP directive stays at Helmet's default; CSP itself remains enforced.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": [
                "'self'",
                "data:",
                "https://res.cloudinary.com",
                "https://images.unsplash.com",
            ],
        },
    },
}));
app.use(compression());
// CORS via the options-delegate form (per-request access to req.headers).
// Same-origin must always pass: the SPA and API ship from the same URL
// (Railway/VPS), and browsers still send Origin on module script/asset
// requests (<script type="module" crossorigin>), so the deployment's own
// host has to be allowed even though no cross-origin request is happening.
app.use(cors((req, callback) => {
    const origin = req.headers.origin;
    let allowed = false;

    if (!origin) {
        // No origin: curl, mobile apps, same-origin navigations
        allowed = true;
    } else if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        // Any localhost / 127.0.0.1 port in development
        allowed = true;
    } else if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(origin)) {
        // IP-address origins (server accessed via http://<server-ip> — no domain yet)
        allowed = true;
    } else {
        // Same-origin: Origin host matches the request's own Host (or the
        // proxy-forwarded host behind Railway's edge router).
        try {
            const originHost = new URL(origin).host;
            const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
            if (reqHost && originHost === reqHost) allowed = true;
        } catch { /* unparseable origin — stays denied */ }
        // Configured FRONTEND_URL in production (comma-separated list supported)
        if (!allowed) {
            const extra = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
            if (extra.includes(origin)) allowed = true;
        }
    }

    if (allowed) {
        // origin: true → cors reflects the request's Origin header
        callback(null, { origin: true, credentials: true });
    } else {
        const err = new Error(`CORS: origin ${origin} not allowed`);
        err.statusCode = 403;
        callback(err);
    }
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

// ── Static Frontend (single-service deploys: Railway / VPS) ──────────────────
// If the frontend production bundle was copied to backend/public (see
// scripts/prepare-railway.cjs + railway.json), Express serves it directly —
// same-origin API, no CORS, no separate static host. On Vercel this folder
// doesn't exist and the block is skipped entirely.
const path = require('path');
const fs = require('fs');
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
    const indexHtml = path.join(publicDir, 'index.html');
    app.use(express.static(publicDir, {
        index: false,
        maxAge: '1y', // hashed Vite asset filenames are safe to cache hard
        setHeaders: (res, filePath) => {
            if (filePath === indexHtml) res.setHeader('Cache-Control', 'no-cache');
        },
    }));
    // SPA fallback — Express 5 safe (no '*' route pattern): any non-API GET
    // that didn't match a static file serves index.html for React Router.
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
            return res.sendFile(indexHtml);
        }
        next();
    });
    // Boot-time proof of what the deployment image actually ships (visible in
    // Railway deploy logs). If assets are missing here, the image was built
    // without the frontend bake step; if present but requests still fail, it's
    // a filesystem permission issue.
    try {
        const entries = fs.readdirSync(publicDir, { recursive: true });
        const assetCount = entries.filter((e) => e.startsWith('assets/')).length;
        console.log(`[static] backend/public served: ${entries.length} entries, ${assetCount} hashed assets`);
        if (assetCount === 0) console.warn('[static] WARNING: no assets/ files found in backend/public');
    } catch (err) {
        console.error('[static] backend/public exists but is not readable:', err.code);
    }
}

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;