"""
Alembic migration environment — configured for async SQLAlchemy.

Uses DIRECT_URL (port 5432) for migrations, NOT the pooler URL.
Pgbouncer in transaction mode can't handle DDL (CREATE TABLE, ALTER, etc).
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.database import Base

# Import all models so Alembic can detect them for autogenerate
from app.models.farmer import Farmer  # noqa: F401
from app.models.field import Field  # noqa: F401
from app.models.voice_recording import VoiceRecording  # noqa: F401
from app.models.farm_log import FarmLog, FarmLogTask, ChemicalUsage  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Phase 1 tables (managed by Prisma) — tell Alembic to ignore them
PHASE1_TABLES = {"farm", "product", "seasonal_calendar", "gallery_photo", "review", "order_inquiry", "_prisma_migrations"}


def include_object(object, name, type_, reflected, compare_to):
    """Filter out Phase 1 tables so Alembic doesn't try to drop them."""
    if type_ == "table" and name in PHASE1_TABLES:
        return False
    return True

# Use DIRECT_URL for migrations — pgbouncer can't handle DDL
_migration_url = settings.direct_url.replace(
    "postgresql://", "postgresql+asyncpg://", 1
).replace("postgres://", "postgresql+asyncpg://", 1)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting."""
    context.configure(
        url=_migration_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode — connects to the database."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _migration_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
