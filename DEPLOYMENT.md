# Deployment Guide — pedani.eu

Domains:
- **Frontend:** https://financie.pedani.eu → `/var/www/finance-tracker/dist`
- **Backend API:** https://api.pedani.eu → `localhost:3001` (PM2)
- **Database:** PostgreSQL 16 via Docker Compose (localhost:5432)

---

## First-Time Server Setup

Run these steps once on a fresh Hetzner server as the `deploy` user (use `sudo` where indicated).

### 1 — Install PM2 globally

```bash
npm install -g pm2
```

### 2 — Create required directories

```bash
sudo mkdir -p /var/www/finance-tracker/dist
sudo mkdir -p /var/www/finance-tracker-api/dist
sudo mkdir -p /var/log/finance-tracker-api

sudo chown -R deploy:deploy /var/www/finance-tracker
sudo chown -R deploy:deploy /var/www/finance-tracker-api
sudo chown -R deploy:deploy /var/log/finance-tracker-api
```

### 3 — Configure backend environment

```bash
cp /path/to/repo/backend/.env.example /var/www/finance-tracker-api/.env
nano /var/www/finance-tracker-api/.env
```

Fill in real values — **never commit this file**:

```env
DATABASE_URL=postgresql://user:STRONG_PASSWORD@localhost:5432/finance_tracker
JWT_ACCESS_SECRET=<random 64-char string>
JWT_REFRESH_SECRET=<random 64-char string>
PORT=3001
NODE_ENV=production
BCRYPT_ROUNDS=12
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4 — Copy backend PM2 ecosystem config

```bash
cp /path/to/repo/backend/ecosystem.config.js /var/www/finance-tracker-api/
```

### 5 — Install Nginx configs

```bash
sudo cp /path/to/repo/nginx/financie.pedani.eu.conf /etc/nginx/sites-available/
sudo cp /path/to/repo/nginx/api.pedani.eu.conf       /etc/nginx/sites-available/

sudo ln -sf /etc/nginx/sites-available/financie.pedani.eu.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.pedani.eu.conf       /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

### 6 — Issue SSL certificates via Certbot

Frontend cert (already issued if frontend is live):
```bash
sudo certbot --nginx -d financie.pedani.eu
```

Backend API cert (new):
```bash
sudo certbot --nginx -d api.pedani.eu
```

Certbot will automatically patch the Nginx configs with the certificate paths
and set up auto-renewal via a systemd timer.

### 7 — Start PostgreSQL via Docker Compose

```bash
cd /path/to/repo

# Copy and configure Docker env (optional — or pass vars directly)
cp backend/.env.example backend/.env
# Edit backend/.env with the same DB credentials as step 3

docker compose up -d postgres
docker compose ps   # confirm postgres is healthy
```

### 8 — Run initial database migration

```bash
cd /var/www/finance-tracker-api
npx drizzle-kit migrate
```

### 9 — Start the backend with PM2

```bash
cd /var/www/finance-tracker-api
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs finance-tracker-api --lines 50
```

### 10 — Configure PM2 to start on reboot

```bash
pm2 startup          # follow the printed sudo command
pm2 save
```

---

## Routine Deployments

After first-time setup, all deployments use `deploy.sh` from the repo root:

```bash
# Both frontend and backend
./deploy.sh

# Frontend only
./deploy.sh frontend

# Backend only
./deploy.sh backend
```

The script:
1. `git pull` latest code
2. Builds the target(s)
3. Copies files to `/var/www/...`
4. Runs DB migrations (backend only)
5. Restarts PM2 / reloads Nginx

---

## Monitoring

```bash
# PM2 process status
pm2 status

# Live logs
pm2 logs finance-tracker-api

# Error log
tail -f /var/log/finance-tracker-api/error.log

# Nginx access log
sudo tail -f /var/log/nginx/access.log

# PostgreSQL (via Docker)
docker compose logs postgres
```

---

## Database Backup

```bash
docker exec $(docker compose ps -q postgres) \
  pg_dump -U user finance_tracker | gzip > backup-$(date +%F).sql.gz
```

---

## Rollback

```bash
# Roll back to previous PM2 snapshot
pm2 reload finance-tracker-api

# Or manually restart from a previous dist/
pm2 stop finance-tracker-api
# restore old dist/ files
pm2 start ecosystem.config.js --env production
```

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/finance_tracker` |
| `JWT_ACCESS_SECRET` | Secret for 15-min access tokens | 64-char hex |
| `JWT_REFRESH_SECRET` | Secret for 30-day refresh tokens | 64-char hex |
| `PORT` | Backend listen port | `3001` |
| `NODE_ENV` | Runtime environment | `production` |
| `BCRYPT_ROUNDS` | bcrypt cost factor | `12` |
