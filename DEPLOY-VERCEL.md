# 🚀 Deploy EduNexus LMS to Vercel (Frontend + Backend)

This project is set up to run **entirely on Vercel** from a single project at the
repo root:

```
LmsProject/                      ← Vercel project root
├── frontend/                    → built to frontend/dist, served at /
├── api/index.js                 → Vercel serverless function
│                                  (re-exports the Express app)
├── backend/src/app.js           → the Express app (no app.listen)
├── backend/src/index.js         → local/Docker entry (app.listen)
├── package.json                 → npm workspaces (frontend + backend)
└── vercel.json                  → build settings, /api/* rewrite, SPA fallback
```

How it works:

- **Frontend**: Vercel runs `npm run build` → static site in `frontend/dist`,
  served at your domain (`https://your-project.vercel.app`).
- **Backend**: `vercel.json` rewrites every `/api/*` request to the
  `api/index.js` serverless function, which runs your existing Express app
  unchanged. The frontend calls the API **same-origin** (`/api/...`), so there
  are no CORS issues.
- **Database / Cloudinary / Resend**: unchanged — NeonDB PostgreSQL, Cloudinary
  uploads, and Resend email all work from serverless functions.

---

## What was changed for Vercel

| File | Change |
|------|--------|
| `backend/src/index.js` | Slimmed down to only `app.listen()` (local/Docker entry) |
| `backend/src/app.js` | **New** — the full Express app, exported for reuse |
| `api/index.js` | **New** — Vercel function entry: `module.exports = require('../backend/src/app')` |
| `package.json` | **New** — npm workspaces so one `npm install` covers both apps |
| `vercel.json` | **New** — build command, output dir, `/api/*` + SPA rewrites, 300s function timeout |
| `backend/src/utils/mail.js` | Resend client now lazy-initialized (missing API key no longer crashes the whole app) |
| `backend/src/app.js` | `dotenv` loads `backend/.env` by file path (works from any working directory) |

Local development and the existing Docker/VPS setup are **unchanged**.

---

## Step 1 — Commit and push

```bash
git add -A
git commit -m "Add Vercel deployment setup (serverless Express API + Vite frontend)"
git push origin main
```

(The repo is already on GitHub at `github.com/phanikumar1712/LmsProject`.)

## Step 2 — Create a Vercel account and import the repo

1. Go to **[vercel.com](https://vercel.com)** → **Sign Up** → **Continue with
   GitHub** → authorize Vercel.
2. On the dashboard click **Add New… → Project** → find and import
   **LmsProject**.
3. Vercel reads `vercel.json` and pre-fills the settings. Confirm:
   - **Root Directory**: `.` (repo root — this is important, not `frontend/`)
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`
4. Click **Deploy**. The first deploy succeeds, but the app only fully works
   after Step 3 (env vars), so don't worry if login fails yet.

## Step 3 — Set environment variables

In **Project Settings → Environment Variables**, add these for **Production**
(and Development/Preview if you want to test previews). The first four are
required; the rest come from your existing `backend/.env`.

| Variable | Value / Source | Required? |
|----------|----------------|-----------|
| `NODE_ENV` | `production` | ✅ |
| `VITE_API_URL` | `/api` (same-origin API calls — **critical**) | ✅ |
| `FRONTEND_URL` | `https://<your-project>.vercel.app` (after deploy) | ✅ |
| `DATABASE_URL` | your Neon connection string (see Step 4) | ✅ |
| `JWT_SECRET` | from `backend/.env` | ✅ |
| `JWT_EXPIRES_IN` | `7d` (from `backend/.env`) | |
| `CLOUDINARY_CLOUD_NAME` | from `backend/.env` | for uploads |
| `CLOUDINARY_API_KEY` | from `backend/.env` | for uploads |
| `CLOUDINARY_API_SECRET` | from `backend/.env` | for uploads |
| `RESEND_API_KEY` | from `backend/.env` | for OTP emails |
| `RESEND_FROM_EMAIL` | from `backend/.env` | for OTP emails |
| `SUPER_ADMIN_PASSWORD` | from `backend/.env` | ✅ in production |
| `ADMIN_DEFAULT_PASSWORD` | from `backend/.env` | |

> ⚠️ Never paste secret values into chat/screenshots — add them directly in the
> Vercel dashboard. **Don't** add a `PORT` variable (Vercel manages it).

After saving, **Redeploy**: **Deployments → (latest) → ⋯ → Redeploy**.

## Step 4 — Use the Neon *pooled* connection string (recommended)

Serverless functions each hold their own DB pool, so on Neon you should use the
**pooled connection** (PgBouncer) endpoint instead of the direct one, or you can
hit "remaining connection slots reserved" errors under load:

1. Neon console → your project → **Settings → Connection Details**.
2. Switch the dropdown to **Pooled connection** (host looks like
   `…-pooler.neon.tech`).
3. Put that string in the Vercel `DATABASE_URL` variable.

## Step 5 — Run database migrations

Schema + seed data are created by `npm run migrate`. If your Neon database was
already migrated locally, **nothing to do**. If it's brand new:

```bash
cd backend
npm run migrate     # uses backend/.env (NODE_ENV=production there already)
```

⚠️ With `NODE_ENV=production` the migration **requires `SUPER_ADMIN_PASSWORD`**
and **deletes all `*@demo.com` demo accounts** (by design — production never
ships known demo credentials). Demo login (`/api/auth/demo`) is also disabled in
production. Create real users after deploying, or run the migration with
`NODE_ENV=development` if you want demo accounts for testing the deployed app.

Vercel has no one-off runner — run migrations from your machine against the same
`DATABASE_URL`. The schema is idempotent (`IF NOT EXISTS`), so re-running is safe.

## Step 6 — Verify

- Open `https://<your-project>.vercel.app/api/health` → should return
  `{"status":"ok", ...}`.
- Open the site, log in as the super admin, and click around (courses,
  dashboards, uploads).

---

## ⚠️ Vercel serverless limits to know

| Limit | Value | Impact |
|-------|-------|--------|
| Request body | **4.5 MB** | Bulk CSV/Excel imports are capped at 5 MB in multer — keep import files under ~4 MB |
| Function duration | **300 s** (Hobby max with fluid compute) | Bulk import previews (up to 120 s client-side) fit comfortably; imports are no longer timeout-limited |
| Rate limiting | in-memory | Resets per function instance — still effective per-request, not global |
| DB connections | Neon pooled cap | Fixed by Step 4 (pooled connection string) |

Everything else — WebSockets (`ws` is installed but never used), filesystem
writes (all uploads are `multer.memoryStorage()` → Cloudinary), long-running
background jobs (none) — is serverless-safe already.

---

## Local development (unchanged)

```bash
# from the repo root
npm install
npm run dev:frontend   # Vite on :5173
npm run dev:backend    # Express on :5000
```

Or the original Docker flow: `docker-compose up --build`.

## Redeploying & rollback

- **Deploy**: just `git push` — Vercel auto-deploys.
- **Rollback**: Dashboard → **Deployments** → pick a previous deployment → ⋯ →
  **Promote to Production**.