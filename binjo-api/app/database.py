"""
Database engine and session factory.

Uses asyncpg for async PostgreSQL connections.
Same Supabase database as Phase 1 — Prisma (Node.js) and SQLAlchemy (Python) coexist.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy async driver
_db_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
    "postgres://", "postgresql+asyncpg://", 1
)

# pool_pre_ping=True — checks connection health before checkout,
# prevents "connection closed" errors after DB restarts or idle timeouts
engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# expire_on_commit=False — lets us access attributes after commit
# without triggering a lazy load (which would fail outside the session)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency Injection — FastAPI injects a fresh session per request.
    The session is automatically closed after the request completes,
    even if an error occurs. This prevents connection leaks.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
