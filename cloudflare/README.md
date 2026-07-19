# Cloudflare — R+ Equipos backend

Deploy the **Lumify / EKG / Ultrasonido** queue to Cloudflare (Worker + D1 + R2). No LAN host Mac required.

**Worker code:** [`../cloud/equipos-worker/`](../cloud/equipos-worker/)

---

## Setup from the Cloudflare Dashboard (recommended)

Do these **in order** in [dash.cloudflare.com](https://dash.cloudflare.com). You only need the terminal once at the end to deploy code (or connect Git).

### 1. Enable R2 (required — error 10042 if skipped)

1. Sidebar → **R2 object storage**
2. **Get started** / **Enable R2** (accept terms — free tier includes 10 GB storage)
3. **Create bucket** → name: `rplus-equipos-photos` → **Create bucket**

> Without R2, Lumify/EKG checkout photos and material/failure reports cannot be stored.

### 2. Create D1 database

1. Sidebar → **Workers & Pages** → **D1 SQL database**
2. **Create database** → name: `rplus-equipos` → **Create**
3. Open the database → **Console** tab
4. Paste the full contents of [`cloud/equipos-worker/schema/001-init.sql`](../cloud/equipos-worker/schema/001-init.sql) → **Run**

### 3. Deploy the Worker (pick one)

**Option A — Git (stays in Dashboard after first connect)**

1. **Workers & Pages** → **Create** → **Worker** → **Connect to Git**
2. Select this repo → root directory: `cloud/equipos-worker`
3. Build command: `npm install`
4. Deploy command: `npx wrangler deploy`
5. On first deploy, open the worker → **Settings** → **Bindings** and confirm:
   - **D1** `DB` → `rplus-equipos`
   - **R2** `PHOTOS` → `rplus-equipos-photos`
   - (Assets binding comes from `wrangler.toml` on deploy)

**Option B — One terminal deploy (after steps 1–2)**

```bash
cd cloud/equipos-worker
npm install
```

Copy your D1 **Database ID** from Dashboard → D1 → `rplus-equipos` → **Settings**, then edit `wrangler.toml`:

```toml
database_id = "paste-your-uuid-here"
```

```bash
npx wrangler login
npx wrangler secret put EQUIPOS_ADMIN_KEY   # long random string — save it
npm run deploy
```

Note the deploy URL: `https://rmas-lista-de-espera.<account>.workers.dev` — **for testing only**. Residents should not get that link; use a **custom domain** (step 3b).

### 3b. Custom domain (required for a clean public link)

Cloudflare always puts your account name in `*.workers.dev` URLs (e.g. `laboratoriazo-lic`). You **cannot** remove that without your own hostname.

1. Your domain must be on Cloudflare (same account) — e.g. `rmas.org`, `hospital.edu.mx`.
2. **Workers & Pages** → **rmas-lista-de-espera** → **Settings** → **Domains & Routes** → **Add** → **Custom domain**.
3. Enter something like `lista-de-espera.tudominio.org` (subdomain of your choice).
4. Wait for SSL **Active** (usually 1–5 min).
5. Optional: uncomment `[[routes]]` + `EQUIPOS_PUBLIC_ORIGIN` in `cloud/equipos-worker/wrangler.toml`, then `npm run deploy`.
6. In R+ desktop, **URL cloud** = `https://lista-de-espera.tudominio.org` (not the workers.dev URL).

Verify: `curl -s "https://lista-de-espera.tudominio.org/api/equipos/v1/ping"`

### 4. Secrets (Dashboard)

1. **Workers & Pages** → **rmas-lista-de-espera** → **Settings** → **Variables and Secrets**
2. **Add** → type **Secret** → name: `EQUIPOS_ADMIN_KEY` → value: (same string you will enter in R+ desktop)

### 5. Cron (photo retention — optional check)

**Workers & Pages** → **rmas-lista-de-espera** → **Triggers** → should show `0 6 * * *` after deploy (from `wrangler.toml`). If missing, add cron: `0 6 * * *`. Deletes photos **older than 14 days** only (admin history window).

### 6. Configure R+ desktop

1. **⇄ LAN** → **Equipos (Lumify / EKG / US)** → **Cola en Cloudflare**
2. **URL cloud** → your **custom domain** URL (see §3b), not `*.laboratoriazo-lic.workers.dev`
3. **Clave admin** → same as `EQUIPOS_ADMIN_KEY`
4. **Guardar cloud** → **Regenerar token** → share QR

### Verify

Open in browser: `https://YOUR-URL/api/equipos/v1/ping`  
Should return JSON with `"equipos": true, "cloud": true`.

---

## CLI setup (alternative)

If R2 is already enabled:

```bash
npx wrangler login
node cloudflare/setup.mjs
```

---

## Before you start (CLI path only)

1. [Cloudflare account](https://dash.cloudflare.com/sign-up) (free plan works)
2. Node.js 18+
3. Log in once in your terminal:

```bash
npx wrangler login
npx wrangler whoami   # should show your account
```

Optional: [API token](https://dash.cloudflare.com/profile/api-tokens) with **Workers + D1 + R2** edit instead of OAuth — set `CLOUDFLARE_API_TOKEN`.

## Automated setup (recommended)

From the repo root:

```bash
node cloudflare/setup.mjs
```

This will:

1. Install worker dependencies
2. Create D1 database `rplus-equipos` (if needed) and patch `wrangler.toml`
3. Create R2 bucket `rplus-equipos-photos` (if needed)
4. Apply SQL schema to remote D1
5. Prompt you to set `EQUIPOS_ADMIN_KEY` (pick a long random string — same value goes in R+ desktop)
6. Deploy the worker

At the end you get a workers.dev URL for smoke tests. Add a **custom domain** (see §3b in Dashboard path) before sharing QR codes.

## Manual steps (if you prefer)

```bash
cd cloud/equipos-worker
npm install
npx wrangler d1 create rplus-equipos
# → paste database_id into wrangler.toml
npx wrangler r2 bucket create rplus-equipos-photos
npm run db:migrate:remote
npx wrangler secret put EQUIPOS_ADMIN_KEY
npm run deploy
```

## Configure R+ desktop

1. **⇄ LAN** → **Equipos (Lumify / EKG / US)**
2. Expand **Cola en Cloudflare**
3. **URL cloud** → custom domain (e.g. `https://lista-de-espera.tudominio.org`)
4. **Clave admin** → same string as `EQUIPOS_ADMIN_KEY`
5. **Guardar cloud** → **Regenerar token** → share QR

## Custom domain

See **§3b** above. Dashboard → **rmas-lista-de-espera** → **Domains & Routes** → add e.g. `lista-de-espera.tudominio.org`.

Then uncomment in `wrangler.toml`:

```toml
[[routes]]
pattern = "lista-de-espera.tudominio.org"
custom_domain = true

[vars]
EQUIPOS_PUBLIC_ORIGIN = "https://lista-de-espera.tudominio.org"
```

Redeploy: `npm run deploy` from `cloud/equipos-worker`.

## Verify deployment

```bash
curl -s "https://YOUR-WORKER-URL/api/equipos/v1/ping" | jq
# → { "ok": true, "equipos": true, "cloud": true, ... }
```

Open `https://YOUR-WORKER-URL/?t=TOKEN` after generating a token in R+.

## Local dev

```bash
cd cloud/equipos-worker
npm run db:migrate:local
cp .dev.vars.example .dev.vars   # edit EQUIPOS_ADMIN_KEY
npm run dev
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Not logged in` | Run `npx wrangler login` in your terminal |
| D1 `database_id` placeholder | Re-run `node cloudflare/setup.mjs` or paste ID from Dashboard → D1 |
| R2 bucket exists | Safe to ignore; setup continues |
| 403 on admin API | `EQUIPOS_ADMIN_KEY` mismatch between Worker secret and R+ desktop |
| Cron on free plan | One cron per worker — already configured for 06:00 UTC purge |

Full API reference: [`cloud/equipos-worker/README.md`](../cloud/equipos-worker/README.md).
