# NTWRKH — Production-Ready SaaS Deployment

AI-powered social content discovery & distribution platform for WhatsApp and Telegram, backed by Node.js, PostgreSQL (Prisma), Redis (BullMQ), Cloudinary, Caddy HTTPS, and GitHub Actions CI/CD.

## Included Features
- **Unified WhatsApp & Telegram Bot (`src/botRouter.js`):** Onboarding, niche hashtag setup, social account linking, AI hashtag expansion, and cross-network creator alerts.
- **Direct Media Upload (`src/mediaUploader.js`):** Streams raw video/image files sent in WhatsApp or Telegram straight to Cloudinary (auto-formatted as MP4).
- **Async Background Worker (`src/queue.js`, `src/worker.js`):** BullMQ + Redis handles media transcoding and Instagram/TikTok API publishing without blocking webhook responses.
- **Meta & TikTok Compliance Pages (`src/legalPages.js`):** Built-in `/privacy` and `/terms` HTML endpoints required for Meta and TikTok production app audits.
- **Automated CI/CD (`.github/workflows/deploy.yml`):** Automatically rebuilds and restarts your production Docker stack on every push to `main`.

## 1. Local Development
```bash
cp .env.example .env
docker compose up --build
```

## 2. Production VPS Deployment
1. Provision an Ubuntu 24.04 VPS and point your domain's DNS `A` record to the server IP.
2. Edit `Caddyfile` and replace `yourdomain.com` with your live domain.
3. Clone your repository into `/opt/ntwrkh` on the VPS and create `.env.production` from `.env.example`.
4. Start the production stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

## 3. GitHub Actions Auto-Deploy Setup
In your GitHub repository go to **Settings → Secrets and variables → Actions** and add:
- `VPS_HOST`: Your server IP address
- `VPS_USER`: SSH username (e.g. `root` or `ubuntu`)
- `VPS_SSH_KEY`: Your private SSH key
