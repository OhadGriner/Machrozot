import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.services import job_store
from app.services.auth_service import create_access_token

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


@pytest.fixture
async def admin_headers(db_session: AsyncSession, monkeypatch):
    """A real admin: allowlisted email + valid JWT."""
    monkeypatch.setattr(settings, "admin_emails", "admin@example.com")
    user = User(google_sub="admin-sub", email="admin@example.com", name="Admin", picture_url=None)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(user)}"}
