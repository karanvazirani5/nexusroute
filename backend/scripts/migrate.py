"""Standalone schema migration.

Creates every panel table via SQLAlchemy's ``Base.metadata.create_all``.
Idempotent — safe to run multiple times.

Use this once, right after pointing ``DATABASE_URL`` at your new
Postgres (Supabase / Neon / Railway Postgres), to bootstrap the schema.
Subsequent deploys don't need to run it — Railway will pick up the
existing tables.

Usage::

    # From inside the backend/ directory
    python scripts/migrate.py

    # Or one-shot with a fresh URL
    DATABASE_URL='postgresql+asyncpg://user:pwd@host:5432/db' \\
        python scripts/migrate.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.config import get_settings
from app.models.database import Base, engine


async def main() -> None:
    settings = get_settings()
    print(f"→ running migration against {settings.database_url.split('@')[-1]}")
    print(f"→ dialect: {'Postgres' if settings.is_postgres else 'SQLite'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ schema created (create_all is idempotent)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
