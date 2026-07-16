import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.services import job_store

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def in_memory_db_engine():
    db_engine = create_async_engine(TEST_DB_URL)
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield db_engine
    await db_engine.dispose()


@pytest.fixture
async def db_session(in_memory_db_engine):
    session_factory = async_sessionmaker(in_memory_db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
async def api(db_session: AsyncSession, in_memory_db_engine, monkeypatch):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Background jobs (e.g. shuffle) open their own session via
    # app.database.AsyncSessionLocal rather than the get_db dependency, since
    # they run after the request that created them has already returned —
    # point that at the same in-memory engine the test uses.
    test_session_factory = async_sessionmaker(in_memory_db_engine, expire_on_commit=False)
    monkeypatch.setattr("app.routers.admin.AsyncSessionLocal", test_session_factory)
    job_store.reset()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()
