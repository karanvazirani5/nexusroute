from contextlib import asynccontextmanager
import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.models.database import init_db, async_session, ModelRecord

settings = get_settings()
logger = logging.getLogger(__name__)

MODEL_RECORD_COLUMNS = {c.name for c in ModelRecord.__table__.columns}


def _ensure_tz_aware(dt) -> datetime:
    """Coerce any datetime to UTC-aware. asyncpg rejects mixed tz in batches."""
    if dt is None:
        return datetime.now(timezone.utc)
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return datetime.now(timezone.utc)
    if isinstance(dt, datetime) and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_model_dict(raw: dict) -> dict:
    """Filter to valid ModelRecord columns and coerce types where needed."""
    cleaned = {k: v for k, v in raw.items() if k in MODEL_RECORD_COLUMNS}

    # Force every datetime column to be timezone-aware so asyncpg doesn't
    # choke on mixed naive/aware values in a batch insert.
    for dt_col in ("last_verified_at", "created_at", "updated_at"):
        if dt_col in cleaned:
            cleaned[dt_col] = _ensure_tz_aware(cleaned[dt_col])
        else:
            cleaned[dt_col] = datetime.now(timezone.utc)

    return cleaned


async def seed_models():
    """Load models from the intelligence registry JSON into the database."""
    registry_path = settings.data_dir / "model_registry.json"
    if not registry_path.exists():
        return

    with open(registry_path) as f:
        data = json.load(f)

    models_list = data if isinstance(data, list) else data.get("models", [])

    async with async_session() as session:
        result = await session.execute(select(ModelRecord).limit(1))
        existing = result.scalars().first()

        if existing is not None:
            count_result = await session.execute(select(ModelRecord.id))
            existing_count = len(count_result.scalars().all())
            if existing_count == len(models_list):
                return

            for old in (await session.execute(select(ModelRecord))).scalars().all():
                await session.delete(old)
            await session.commit()

        for m in models_list:
            record = ModelRecord(**_parse_model_dict(m))
            session.add(record)
            await session.flush()  # insert one at a time — avoids asyncpg executemany tz mismatch
        await session.commit()
        logger.info("Seeded %d models from registry", len(models_list))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_models()
    yield


# ── Simple in-memory rate limiter ─────────────────────────────────
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limits requests per IP. 60 req/min for writes, 200 req/min for reads."""
    def __init__(self, app, write_limit: int = 60, read_limit: int = 200, window: int = 60):
        super().__init__(app)
        self.write_limit = write_limit
        self.read_limit = read_limit
        self.window = window
        self.hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Prune old hits
        self.hits[ip] = [t for t in self.hits[ip] if now - t < self.window]
        limit = self.write_limit if request.method in ("POST", "PUT", "PATCH", "DELETE") else self.read_limit
        if len(self.hits[ip]) >= limit:
            return Response(content='{"detail":"Rate limit exceeded. Try again in a minute."}',
                            status_code=429, media_type="application/json")
        self.hits[ip].append(now)
        return await call_next(request)

app = FastAPI(
    title=settings.app_name,
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import events, gold, health, insights, intelligence, models  # noqa: E402

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(models.router, prefix="/api", tags=["models"])
app.include_router(events.router, prefix="/api", tags=["panel"])
app.include_router(insights.router, prefix="/api", tags=["panel"])
app.include_router(intelligence.router, prefix="/api", tags=["panel"])
app.include_router(gold.router, prefix="/api", tags=["panel"])
