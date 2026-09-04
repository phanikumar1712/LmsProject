# Deploying to a VPS (no Docker, no domain)

Your repo ships with a Docker Compose setup, but this folder is a **plain-VPS
alternative**: the Express backend runs under **systemd**, nginx serves the
built React frontend and proxies `/api` to the backend. Perfect for a small
server (2 GB RAM is plenty) hosting fewer than 50 users at `http://<server-ip>`.

## 1. Get a server

Any Ubuntu 22.04/24.04 VPS. Good low-cost options: Hetzner CX22 (~$4/mo) or
DigitalOcean basic droplet (~$6/mo). A 1 vCPU / 2 GB RAM droplet is enough for
this scale. Make sure port **80** is open in the firewall (and 22 for SSH).

## 2. Put the code on the server

```bash
git clone https://github.com/phanikumar1712/LmsProject.git /root/lms
cd /root/lms
```

## 3. Configure the backend environment

The backend needs a `backend/.env` file. The easiest path: **copy the one you
already use locally** (it already has your Neon DB, Resend, and Cloudinary
keys):

```bash
# from your local machine
scp backend/.env root@<server-ip>:/root/lms/backend/.env
```

Or create it from the template on the server and fill in the values:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Required for production (the migration **refuses to run** without them):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon Postgres connection string |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `SUPER_ADMIN_PASSWORD` | Strong password for the super admin account |
| `FRONTEND_URL` | Leave `http://localhost` — the setup script overwrites it with your server IP |

Optional: `RESEND_API_KEY` (OTP/forgot-password emails), `CLOUDINARY_*`
(thumbnail & lesson file uploads).

## 4. Run the setup script

```bash
sudo bash deploy/setup.sh
```

The script is **idempotent** — re-running it after `git pull` redeploys. It will:

1. Install Node.js 20, nginx, git, rsync
2. Copy the repo to `/opt/lms` (ignoring `node_modules`, `.git`, `dummy/`, env files)
3. Keep your existing `backend/.env` and set `FRONTEND_URL=http://<server-ip>`
4. Install backend deps, build the frontend, run `npm run migrate`
5. Install & start the `lms-backend` systemd service and the nginx site

## 5. Done — access it

```
http://<server-ip>
```

Verify the API: `curl http://<server-ip>/api/health`

Log in as your super admin (email `superadmin@lms.com`, password from
`SUPER_ADMIN_PASSWORD` — created by the migration).

## Day-to-day operations

| Task | Command |
|---|---|
| Deploy latest code | `cd /root/lms && git pull && sudo bash deploy/setup.sh` |
| Backend logs | `journalctl -u lms-backend -f` |
| Restart backend | `sudo systemctl restart lms-backend` |
| Nginx logs | `tail -f /var/log/nginx/error.log` |
| Re-run migrations | `cd /opt/lms/backend && sudo npm run migrate` |

## Adding HTTPS + a domain later

1. Buy a domain and point an `A` record at your server IP.
2. In `/etc/nginx/sites-available/lms` change `server_name _;` to your domain.
3. Run `sudo certbot --nginx -d yourdomain.com` (needs `sudo apt install certbot python3-certbot-nginx`).
4. Update `FRONTEND_URL` in `/opt/lms/backend/.env` to `https://yourdomain.com`
   and restart: `sudo systemctl restart lms-backend`.

## Troubleshooting

- **Blank page / API errors** → `curl http://<server-ip>/api/health`; if it
  fails, check `journalctl -u lms-backend -n 50` and that `DATABASE_URL` is correct.
- **CORS errors in the browser console** → confirm `FRONTEND_URL` in
  `/opt/lms/backend/.env` equals `http://<server-ip>` exactly, then restart the backend.
- **Login says "Too many attempts"** → rate limiting is on in production
  (10/hour per IP for auth) — wait or use a different network.
- **Migrations failed during setup** → fill in `SUPER_ADMIN_PASSWORD` /
  `DATABASE_URL` in `/opt/lms/backend/.env`, then `cd /opt/lms/backend && sudo npm run migrate`.