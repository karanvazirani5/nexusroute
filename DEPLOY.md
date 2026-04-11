# Deploy guide — NexusRoute + Intent Panel

Two services, one platform for the backend + database:

```
Vercel   →  frontend (Next.js)
Railway  →  backend (FastAPI + SSE) + Postgres (same project)
```

Both have free tiers. Railway's trial gives you $5/month of credit which
covers the backend + a Postgres addon together. Total setup: ~20 min.

Everything deploy-related is already in the repo — deploy files,
migration scripts, preflight checks. You just create the accounts,
paste env vars, and click deploy.

---

## Step 1 · Railway: backend + Postgres (≈10 min)

### 1a. Create the project

1. Go to <https://railway.app> → **Login with GitHub**
2. **New Project → Empty Project**

### 1b. Add Postgres to the project

1. Inside your project: **+ New → Database → Add PostgreSQL**
2. Railway instantly provisions a Postgres instance and creates a
   `DATABASE_URL` variable inside it. You don't have to copy anything.

### 1c. Deploy the backend

Run these in your terminal:

```bash
cd "/Users/karanvazirani/Desktop/AI model routing platfrom/backend"
railway login          # opens browser, click authorize
railway link           # pick the project you just created
railway up             # uploads and deploys — ~90 seconds
```

### 1d. Wire the backend to the Postgres addon

Railway auto-creates a `DATABASE_URL` on the Postgres service but not
on your backend service. You need to create a **reference variable**:

1. Railway dashboard → click your **backend service** (not the
   Postgres one)
2. **Variables → + New Variable**
3. Key: `DATABASE_URL`
4. Value: click the **$** icon → select **Postgres → DATABASE_URL**
   (this creates a live reference so the URL updates automatically)
5. **Important:** the Railway-provided URL starts with `postgresql://`.
   Your backend needs `postgresql+asyncpg://`. So edit the value to:

   ```
   postgresql+asyncpg://${Postgres.DATABASE_URL#postgresql://}
   ```

   **OR** just prepend `+asyncpg` in the protocol part manually. If
   the reference variable approach is confusing, you can also:
   - Click the **Postgres service → Variables → copy `DATABASE_URL`**
   - Paste it into your backend service's variables
   - Change `postgresql://` → `postgresql+asyncpg://`

6. Add the rest of your env vars on the backend service:

   | key | value |
   |---|---|
   | `OPENAI_API_KEY` | same key from `frontend/.env.local` *(optional)* |
   | `TIER2_CLASSIFIER_MODEL` | `gpt-4o-mini` |
   | `DEBUG` | `false` |

   Leave `CORS_ORIGINS` blank for now (you'll add it in Step 3).

### 1e. Set root directory (if deploying the whole monorepo)

If you ran `railway up` from inside `backend/`, skip this. If you
pointed Railway at the whole repo via GitHub, go to:

**Settings → Root Directory → `backend`**

### 1f. Generate a public URL

**Settings → Networking → Generate Domain**

You'll get something like:
`https://nexusroute-backend-production.up.railway.app`

### 1g. Verify

```bash
curl https://<your-railway-url>/api/health
curl https://<your-railway-url>/api/panel/insights/categories | head -c 200
```

Both should return JSON.

---

## Step 2 · Vercel: frontend (≈5 min)

```bash
cd "/Users/karanvazirani/Desktop/AI model routing platfrom/frontend"
vercel login           # if not already logged in
vercel                 # first deploy
```

Answer the prompts:
- **Set up and deploy?** `Y`
- **Link to existing project?** `N`
- **Project name?** `nexusroute`
- **Directory?** `./`
- **Override settings?** `N`

Vercel builds and gives you a preview URL. Dashboard will say "Panel
offline" — that's because env vars aren't set yet.

### Add env vars

Vercel dashboard → your project → **Settings → Environment Variables**:

| key | value | environments |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-railway-url>/api` | Production, Preview |
| `OPENAI_API_KEY` | same key from `frontend/.env.local` | Production, Preview |
| `ADVISOR_INTERPRET_MODEL` | `gpt-4o-mini` | Production, Preview |

### Redeploy with env vars baked in

```bash
vercel --prod
```

Copy the production URL (e.g. `https://nexusroute.vercel.app`).

---

## Step 3 · Wire CORS (≈1 min)

Back in Railway → backend service → **Variables → + New Variable**:

| key | value |
|---|---|
| `CORS_ORIGINS` | `https://<your-vercel-url>.vercel.app` |

Railway auto-redeploys.

---

## Step 4 · Smoke test (≈3 min)

1. **`https://<vercel-url>/advisor`** → accept consent → submit a prompt → click "Copy model id"
2. **`https://<vercel-url>/dashboard`** → live ticker green, narrative updates, your event appears
3. **`https://<vercel-url>/explorer`** → click the row → Prompt DNA radar
4. Railway dashboard → click the **Postgres service → Data tab** → browse `prompt_events` → your row is there

---

## Troubleshooting

| symptom | fix |
|---|---|
| `asyncpg` error on boot | `DATABASE_URL` uses `postgresql://` not `postgresql+asyncpg://` |
| CORS blocked in browser | `CORS_ORIGINS` missing your exact Vercel URL (no trailing slash) |
| 404 on `/api/panel/*` | Railway deployed stale code — redeploy from Deployments tab |
| Ticker shows "reconnecting…" | Railway proxy buffering — `--proxy-headers` in Procfile handles this |
| "Panel offline" on dashboard | Forgot `vercel --prod` after adding `NEXT_PUBLIC_API_URL` |

---

## After launch

```bash
# Wipe test data (Railway Postgres console or local)
psql $DATABASE_URL -c "TRUNCATE prompt_events, panel_sessions, panel_users, panel_consents;"

# Schedule Tier 2 enrichment (add as a Railway cron service)
python scripts/enrich_events.py --hours 1

# Run the local preflight anytime
bash scripts/preflight.sh
```
