#!/usr/bin/env bash
# deploy.sh — guided deploy script
# Run this and follow the prompts. It does as much as possible
# automatically and tells you exactly what to click/paste manually.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}$1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
wait_for_user() { echo -e "\n  ${YELLOW}▸ $1${NC}"; echo -e "  ${YELLOW}  Press ENTER when done.${NC}"; read -r; }

echo -e "${BOLD}"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  NexusRoute Deploy                          │"
echo "  │  Vercel (frontend) + Railway (backend + db) │"
echo "  └─────────────────────────────────────────────┘"
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════
step "STEP 1 · Railway login"
# ═══════════════════════════════════════════════════════════

if railway whoami >/dev/null 2>&1; then
    ok "Already logged in as $(railway whoami 2>&1)"
else
    echo "  Opening your browser to authorize Railway..."
    echo "  (If no browser opens, copy the URL from the terminal)"
    railway login
    ok "Logged in"
fi

# ═══════════════════════════════════════════════════════════
step "STEP 2 · Create Railway project"
# ═══════════════════════════════════════════════════════════

echo "  Creating a new Railway project called 'nexusroute'..."
cd "$ROOT/backend"
railway init --name nexusroute 2>/dev/null || railway init 2>/dev/null || true
ok "Project linked"

# ═══════════════════════════════════════════════════════════
step "STEP 3 · Add Postgres to the project"
# ═══════════════════════════════════════════════════════════

echo "  Adding a PostgreSQL database to your Railway project..."
railway add --database postgres 2>/dev/null || {
    echo ""
    echo "  The CLI couldn't add Postgres automatically."
    wait_for_user "Go to your Railway dashboard → your project → click '+ New' → 'Database' → 'Add PostgreSQL'. Then come back here."
}
ok "Postgres added"

# ═══════════════════════════════════════════════════════════
step "STEP 4 · Deploy the backend"
# ═══════════════════════════════════════════════════════════

echo "  Uploading backend code to Railway..."
cd "$ROOT/backend"
railway up --detach 2>&1 | tail -5
ok "Backend deploying (Railway builds in ~90s)"

# ═══════════════════════════════════════════════════════════
step "STEP 5 · Set environment variables on Railway"
# ═══════════════════════════════════════════════════════════

echo "  I need your OpenAI API key to set it on Railway."
echo "  (This is the same key from frontend/.env.local)"
echo ""
echo -e "  ${YELLOW}Paste your OPENAI_API_KEY and press ENTER:${NC}"
read -r OPENAI_KEY

if [ -n "$OPENAI_KEY" ]; then
    railway variables set "OPENAI_API_KEY=$OPENAI_KEY" 2>/dev/null && ok "OPENAI_API_KEY set" || echo "  (set it manually in the Railway dashboard)"
    railway variables set "TIER2_CLASSIFIER_MODEL=gpt-4o-mini" 2>/dev/null && ok "TIER2_CLASSIFIER_MODEL set" || true
fi
railway variables set "DEBUG=false" 2>/dev/null && ok "DEBUG set" || true

echo ""
echo "  Now you need to wire DATABASE_URL to the Postgres addon."
echo ""
echo -e "  ${YELLOW}Manual step:${NC}"
echo "  1. Open your Railway dashboard (railway.app)"
echo "  2. Click your backend service → Variables"
echo "  3. Click '+ New Variable'"
echo "  4. Key: DATABASE_URL"
echo "  5. Value: click the Postgres service → Variables tab → copy DATABASE_URL"
echo "  6. IMPORTANT: change postgresql:// to postgresql+asyncpg://"
echo "     (just add +asyncpg after postgresql)"
echo "  7. Save"
wait_for_user "Done setting DATABASE_URL?"

# ═══════════════════════════════════════════════════════════
step "STEP 6 · Generate Railway domain"
# ═══════════════════════════════════════════════════════════

RAILWAY_DOMAIN=$(railway domain 2>/dev/null | grep -o 'https://[^ ]*' || echo "")
if [ -n "$RAILWAY_DOMAIN" ]; then
    ok "Domain: $RAILWAY_DOMAIN"
else
    wait_for_user "Go to Railway dashboard → your backend service → Settings → Networking → Generate Domain. Copy the URL."
    echo -e "  ${YELLOW}Paste your Railway backend URL:${NC}"
    read -r RAILWAY_DOMAIN
fi

echo ""
echo "  Testing backend..."
sleep 5
if curl -sf "$RAILWAY_DOMAIN/api/health" >/dev/null 2>&1; then
    ok "Backend is live at $RAILWAY_DOMAIN"
else
    echo "  Backend may still be building. Check Railway deploy logs."
    echo "  Once it's live, continue."
    wait_for_user "Backend is live?"
fi

# ═══════════════════════════════════════════════════════════
step "STEP 7 · Deploy frontend to Vercel"
# ═══════════════════════════════════════════════════════════

cd "$ROOT/frontend"

echo "  Deploying to Vercel..."
VERCEL_URL=$(vercel --yes 2>&1 | grep -o 'https://[^ ]*' | head -1 || echo "")
if [ -n "$VERCEL_URL" ]; then
    ok "Preview deployed: $VERCEL_URL"
else
    echo "  Vercel deploy didn't return a URL. Check vercel.com dashboard."
    echo -e "  ${YELLOW}Paste your Vercel preview URL:${NC}"
    read -r VERCEL_URL
fi

# ═══════════════════════════════════════════════════════════
step "STEP 8 · Set Vercel env vars"
# ═══════════════════════════════════════════════════════════

echo "  Setting NEXT_PUBLIC_API_URL..."
echo "$RAILWAY_DOMAIN/api" | vercel env add NEXT_PUBLIC_API_URL production 2>/dev/null && ok "NEXT_PUBLIC_API_URL set" || {
    echo ""
    echo "  Couldn't set via CLI. Do it manually:"
    echo "  Vercel dashboard → Settings → Environment Variables:"
    echo "    NEXT_PUBLIC_API_URL = $RAILWAY_DOMAIN/api"
    wait_for_user "Done?"
}

if [ -n "$OPENAI_KEY" ]; then
    echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY production 2>/dev/null && ok "OPENAI_API_KEY set on Vercel" || {
        echo "  Set OPENAI_API_KEY manually in Vercel dashboard"
    }
fi

echo "gpt-4o-mini" | vercel env add ADVISOR_INTERPRET_MODEL production 2>/dev/null && ok "ADVISOR_INTERPRET_MODEL set" || true

echo ""
echo "  Redeploying to production with env vars baked in..."
PROD_URL=$(vercel --prod --yes 2>&1 | grep -o 'https://[^ ]*' | head -1 || echo "")
if [ -n "$PROD_URL" ]; then
    ok "Production URL: $PROD_URL"
else
    echo "  Check vercel.com for your production URL."
    echo -e "  ${YELLOW}Paste your production Vercel URL:${NC}"
    read -r PROD_URL
fi

# ═══════════════════════════════════════════════════════════
step "STEP 9 · Wire CORS on Railway"
# ═══════════════════════════════════════════════════════════

echo "  Setting CORS_ORIGINS to allow $PROD_URL..."
cd "$ROOT/backend"
railway variables set "CORS_ORIGINS=$PROD_URL" 2>/dev/null && ok "CORS set — Railway will auto-redeploy" || {
    echo ""
    echo "  Set CORS_ORIGINS manually in Railway dashboard:"
    echo "    CORS_ORIGINS=$PROD_URL"
    wait_for_user "Done?"
}

# ═══════════════════════════════════════════════════════════
step "DONE 🚀"
# ═══════════════════════════════════════════════════════════

echo -e "  ${GREEN}${BOLD}Your app is live!${NC}"
echo ""
echo "  Frontend:  $PROD_URL"
echo "  Backend:   $RAILWAY_DOMAIN"
echo ""
echo "  Open these in your browser:"
echo "    $PROD_URL/advisor      ← submit prompts"
echo "    $PROD_URL/dashboard    ← intelligence terminal"
echo "    $PROD_URL/explorer     ← raw data search"
echo ""
echo "  First thing to do:"
echo "    1. Open /advisor"
echo "    2. Accept consent (click 'Contribute to research')"
echo "    3. Submit a prompt"
echo "    4. Open /dashboard — watch it appear in real time"
echo ""
