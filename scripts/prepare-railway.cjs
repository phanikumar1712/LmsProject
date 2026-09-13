// Prepares a single-service Railway deployment.
//
// Railway builds ONE service per repo. This script:
//   1. Builds the frontend (root workspace build → frontend/dist)
//   2. Copies it to backend/public — backend/src/app.js serves it as a static
//      SPA with the API on the same origin (no CORS, no second service)
//
// backend/public is a build artifact: it is gitignored and rebuilt on every
// deploy. Run manually with:  node scripts/prepare-railway.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'frontend', 'dist');
const dest = path.join(root, 'backend', 'public');

const rmrf = (p) => fs.rmSync(p, { recursive: true, force: true });

// ── 1. Build frontend (skip only when told to) ───────────────────────────────
if (!process.env.SKIP_FRONTEND_BUILD) {
    console.log('[prepare-railway] building frontend...');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
} else {
    console.log('[prepare-railway] SKIP_FRONTEND_BUILD set — using existing frontend/dist');
}

// ── 2. Copy dist → backend/public ────────────────────────────────────────────
if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('[prepare-railway] FATAL: frontend/dist/index.html not found — build failed?');
    process.exit(1);
}
rmrf(dest);
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(dist, dest, { recursive: true });

const files = fs.readdirSync(dest);
console.log(`[prepare-railway] ✓ copied frontend build to backend/public (${files.length} entries)`);
