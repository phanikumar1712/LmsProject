# 🚄 Deploy EduNexus LMS to Railway (single service)

Railway runs a **long-running Node server** (not serverless). This project deploys
as **ONE Railway service**: the Express backend serves both the API (`/api/*`)
and the built React frontend — same origin, no CORS, no second service.

```
Railway service (Dockerfile build)
├── build:       multi-stage Dockerfile → frontend build copied to backend/public
├── pre-deploy:  npm run migrate --prefix /app/backend → schema + seed (idempotent)
├── start:       npm start --prefix /app/backend → node src/index.js
└── healthcheck: GET /api/health
```

## What was added/changed for Railway

| File | Change |
|------|--------|
| `railpack.json` | **New** — pins Railpack to the Node provider (a stale `server.py` at the root made Railpack misdetect the project as Python and skip installing Node) |
| `Dockerfile` | **New** — multi-stage root image (frontend build → `backend/public`, non-root runtime); primary build path |
| `.dockerignore` | **New** — keeps secrets and dev artifacts out of the image |
| `railway.json` | **New** — Dockerfile builder, pre-deploy/start commands, healthcheck |
| `scripts/prepare-railway.cjs` | **New** — builds frontend, copies `frontend/dist` → `backend/public` |
| `backend/src/app.js` | Serves `backend/public` when it exists (static + SPA fallback, Express 5-safe) |
| `backend/src/app.js` | dotenv `override: false` — platform env vars (PORT, DATABASE_URL, …) always win over a stray `.env` |
| `package.json` | Root `prepare:railway` script |
| `.gitignore` | `backend/public/` is a build artifact, rebuilt every deploy |

Local dev, Docker, and the Vercel setup are **unchanged**. On Vercel
`backend/public` doesn't exist, so the static block is skipped entirely.

## Step 1 — Push this branch

```bash
git add -A && git commit -m "Add Railway single-service deployment setup" && git push origin main
```

## Step 2 — Create the project on Railway

1. Go to [railway.com](https://railway.com) → sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → pick **LmsProject**.
3. Railway reads `railway.json` automatically. In **Settings**, confirm:
   - **Root Directory**: `/` (repo root — important, not `backend/`)
   - Builder: Railpack, with the commands from `railway.json`
4. **Networking → Generate Domain** — Railway routes its public HTTPS domain to
   the port your server binds (`$PORT`). Note the URL for Step 4.

## Step 3 — Set environment variables

**Service → Variables** (Raw Editor accepts all lines at once):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `VITE_API_URL` | `/api` | **Critical — build-time.** The frontend falls back to `localhost:5000` without it |
| `FRONTEND_URL` | `https://<your-service>.up.railway.app` | CORS allow-list (comma-separated for multiple) |
| `DATABASE_URL` | Neon **pooled** string (`…-pooler.neon.tech`) | Same DB as before, or `railway add --database postgres` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | from `backend/.env` | |
| `SUPER_ADMIN_PASSWORD` | strong value | **Required** — production migration fails without it |
| `CLOUDINARY_*` (3 vars) | from `backend/.env` | Uploads |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | from `backend/.env` | OTP emails |

> ⚠️ Don't set `PORT` — Railway injects it and the server already binds to it.
> Never paste secret values into chat/screenshots.

After saving, **Deploy** (or push any commit to trigger a deploy).

## Step 4 — Migrations & database

Two options:

- **Automatic (recommended)**: `railway.json` sets
  `preDeployCommand: npm run migrate --workspace backend` — the schema runs on
  every deploy before the server starts. It's idempotent (`IF NOT EXISTS`), so
  re-running is safe.
- **Manual**: from your machine against the same `DATABASE_URL`:
  `cd backend && npm run migrate`

Production migration behavior: **requires `SUPER_ADMIN_PASSWORD`**, deletes
`*@demo.com` demo accounts, and disables demo login. Seed real users via the
admin UI afterwards.

## Step 5 — Verify

1. `https://<your-service>.up.railway.app/api/health` → `{"status":"ok", ...}`
2. Open the site root — the React app loads; refresh on a deep link
   (`/student`, `/instructor/...`) — SPA fallback serves it
3. Log in as super admin; try an upload and an OTP email

## Railway notes & limits

- **Memory**: the server bundles the video-stack frontend; watch usage under
  Observability. Scale the service if you see restarts (OOM).
- **Logs**: Service → Deployments → View Logs (`morgan` output shows requests).
- **Custom domain**: Settings → Networking → Custom Domain, then add the new
  origin to `FRONTEND_URL` and redeploy.
- **Deploys**: every push to the connected branch auto-deploys; roll back from
  any previous deployment in one click.

## Local test of the Railway flow

```bash
node scripts/prepare-railway.cjs      # build + copy to backend/public
cd backend && PORT=4321 node src/index.js
# check http://localhost:4321, /api/health, and a deep link like /student
```
