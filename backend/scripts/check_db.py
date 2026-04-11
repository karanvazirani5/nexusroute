"""Connection sanity check.

Verifies that ``DATABASE_URL`` is reachable and that all panel tables
exist. Run this BEFORE your first Railway deploy to catch Postgres
connection-string mistakes (wrong host, wrong password, wrong pooler
port, forgotten ``asyncpg`` driver) while you can still fix them in
seconds.

Usage::

    # Against whatever is in backend/.env
    python scripts/check_db.py

    # Against a one-shot override
    DATABASE_URL='postgresql+asyncpg://user:pwd@host:5432/db' \\
        python scripts/check_db.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings


EXPECTED_TABLES = {
    "panel_users",
    "panel_sessions",
    "panel_consents",
    "prompt_events",
    "gold_prompts",
    "models",
}


def _mask(url: str) -> str:
    """Hide password in a DATABASE_URL before printing."""
    import re
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", url)


async def main() -> int:
    settings = get_settings()
    print(f"→ DATABASE_URL: {_mask(settings.database_url)}")
    print(f"→ dialect:      {'Postgres' if settings.is_postgres else 'SQLite'}")

    try:
        engine = create_async_engine(settings.database_url, echo=False)
    except Exception as exc:
        print(f"✗ Could not build engine: {exc}")
        return 1

    try:
        async with engine.connect() as conn:
            if settings.is_postgres:
                result = await conn.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema='public'"
                    )
                )
            else:
                result = await conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                )
            found = {row[0] for row in result.fetchall()}
    except Exception as exc:
        print(f"✗ Could not connect: {exc}")
        await engine.dispose()
        return 1

    print(f"✓ Connection OK")
    print(f"  found {len(found)} tables")

    missing = EXPECTED_TABLES - found
    extras = found - EXPECTED_TABLES

    if missing:
        print(f"⚠ missing tables: {sorted(missing)}")
        print("  → run `python scripts/migrate.py` to create them")
    else:
        print("✓ all expected panel tables present")

    if extras:
        print(f"  (extra tables: {sorted(extras)})")

    # Quick row-count summary per panel table that exists
    if not missing:
        print()
        print("→ row counts")
        async with engine.connect() as conn:
            for table in sorted(EXPECTED_TABLES):
                try:
                    r = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    n = r.scalar()
                    print(f"   {table:20} {n}")
                except Exception as exc:
                    print(f"   {table:20} ERROR {exc}")

    await engine.dispose()
    return 0 if not missing else 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
