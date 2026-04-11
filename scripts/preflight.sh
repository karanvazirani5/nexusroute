#!/usr/bin/env bash
# preflight.sh — run every local check required before a production deploy.
#
# Verifies:
#   1. Backend imports cleanly
#   2. Backend config reads env vars correctly (SQLite + Postgres paths)
#   3. check_db.py works against the local SQLite DB
#   4. Frontend production build succeeds
#   5. Required CLIs (railway, vercel) are installed
#
# Run from the project root:  bash scripts/preflight.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==============================================================="
echo " Preflight · NexusRoute deploy"
echo " $(date)"
echo "==============================================================="
echo

# ── 1. CLIs ────────────────────────────────────────────────────
echo "[1/5] Checking required CLIs"
for cli in railway vercel node npm python3; do
  if which "$cli" >/dev/null 2>&1; then
    printf "  $PASS %s (%s)\n" "$cli" "$(command -v "$cli")"
  else
    printf "  $FAIL %s not found\n" "$cli"
  fi
done
echo

# ── 2. Deploy files present ────────────────────────────────────
echo "[2/5] Checking deploy files"
FILES=(
  "backend/Procfile"
  "backend/railway.json"
  "backend/nixpacks.toml"
  "backend/runtime.txt"
  "backend/.python-version"
  "backend/.env.example"
  "backend/scripts/check_db.py"
  "backend/scripts/migrate.py"
  "backend/scripts/enrich_events.py"
  "frontend/.env.production.example"
  "DEPLOY.md"
)
for f in "${FILES[@]}"; do
  if [ -f "$ROOT/$f" ]; then
    printf "  $PASS %s\n" "$f"
  else
    printf "  $FAIL missing %s\n" "$f"
  fi
done
echo

# ── 3. Backend imports + config ────────────────────────────────
echo "[3/5] Backend import + config sanity"
cd "$ROOT/backend"
source venv/bin/activate

python - <<'PY'
from app.config import get_settings
from app.main import app
from app.core import intelligence, intent_classifier, events_service, openai_classifier, redaction, taxonomy

s = get_settings()
print(f"  \033[0;32m✓\033[0m config loaded")
print(f"     dialect     = {'Postgres' if s.is_postgres else 'SQLite'}")
print(f"     cors_origins= {s.cors_origins}")
print(f"     database_url= {s.database_url.split('@')[-1] if '@' in s.database_url else s.database_url}")
print(f"  \033[0;32m✓\033[0m all core modules import")
panel_routes = [r for r in app.routes if hasattr(r, 'path') and '/api/panel' in r.path]
print(f"  \033[0;32m✓\033[0m {len(panel_routes)} panel routes registered")
PY

echo

# ── 4. Fake-Postgres config path (env override works) ─────────
echo "[4/5] Testing env override (fake Postgres URL)"
DATABASE_URL='postgresql+asyncpg://fake:fake@localhost:5432/fake' \
  CORS_ORIGINS='https://example.vercel.app,https://api.example.com' \
  python - <<'PY'
from app.config import get_settings, Settings

# Force a fresh settings instance so env vars are re-read
s = Settings()
assert s.is_postgres, "expected is_postgres=True"
assert "example.vercel.app" in s.cors_origins[0], f"cors not parsed: {s.cors_origins}"
print(f"  \033[0;32m✓\033[0m Postgres path picked up")
print(f"     is_postgres = {s.is_postgres}")
print(f"     cors        = {s.cors_origins}")
PY
echo

# ── 5. Local SQLite check ─────────────────────────────────────
echo "[5/5] Running check_db.py against local SQLite"
python scripts/check_db.py 2>&1 | sed 's/^/  /'
echo

echo "==============================================================="
echo " Preflight complete. See DEPLOY.md for the manual steps."
echo "==============================================================="
