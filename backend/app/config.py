from __future__ import annotations

from typing import Annotated, Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "NexusRoute Model Advisor"
    debug: bool = False

    # Database — SQLite for local dev, Postgres (asyncpg) for prod.
    #
    # Local default:
    #   sqlite+aiosqlite:///./routing_platform.db
    # Production example (Supabase / Neon / Railway Postgres):
    #   postgresql+asyncpg://user:pwd@host:5432/dbname
    database_url: str = "sqlite+aiosqlite:///./routing_platform.db"

    # Routing defaults (used by the /api/models/best-for scoring layer).
    default_optimize_for: str = "balanced"

    # Freshness settings.
    model_stale_after_days: int = 30

    # CORS — comma-separated via the ``CORS_ORIGINS`` env var in prod,
    # falls back to localhost for dev.
    #
    # ``Annotated[..., NoDecode]`` tells pydantic-settings NOT to try
    # JSON-parsing the env value — without it, a comma-separated string
    # would crash the settings loader. The validator below then splits
    # the string into a proper ``list[str]``.
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v: Any) -> Any:
        if v is None:
            return v
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def data_dir(self) -> Path:
        return Path(__file__).parent / "data"

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith(("postgresql", "postgres"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
