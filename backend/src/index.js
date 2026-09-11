// Entry point for the long-running Node server (Docker / VPS / local dev).
// The Express app itself lives in ./app.js so the same app can be exported
// as a Vercel serverless function (see /api/index.js at the repo root).
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 LMS Backend running on http://0.0.0.0:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});