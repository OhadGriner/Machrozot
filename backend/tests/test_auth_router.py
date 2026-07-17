import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User

GOOGLE_CLAIMS = {
    "sub": "google-sub-123",
    "email": "player@example.com",
    "name": "Player One",
    "picture": "https://example.com/pic.jpg",
}


@pytest.fixture
def fake_google(monkeypatch):
    async def fake_verify(credential: str) -> dict:
        return GOOGLE_CLAIMS

    monkeypatch.setattr("app.services.auth_service.verify_google_token", fake_verify)


async def test_google_login_creates_user_and_returns_valid_token(api: AsyncClient, fake_google):
    response = await api.post("/api/auth/google", json={"credential": "fake"})
    assert response.status_code == 200
    data = response.json()

    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "player@example.com"
    assert data["user"]["is_admin"] is False
    payload = jwt.decode(data["access_token"], settings.secret_key, algorithms=[settings.algorithm])
    assert payload["sub"] == str(data["user"]["id"])


async def test_second_login_reuses_user_and_refreshes_profile(
    api: AsyncClient, fake_google, db_session: AsyncSession, monkeypatch
):
    await api.post("/api/auth/google", json={"credential": "fake"})

    updated = {**GOOGLE_CLAIMS, "name": "New Name"}

    async def fake_verify(credential: str) -> dict:
        return updated

    monkeypatch.setattr("app.services.auth_service.verify_google_token", fake_verify)
    response = await api.post("/api/auth/google", json={"credential": "fake"})

    count = (await db_session.execute(select(func.count(User.id)))).scalar_one()
    assert count == 1
    assert response.json()["user"]["name"] == "New Name"


async def test_invalid_google_credential_is_rejected(api: AsyncClient):
    # Real verification runs (no monkeypatch) and fails on a garbage credential.
    response = await api.post("/api/auth/google", json={"credential": "garbage"})
    assert response.status_code == 401


async def test_me_returns_current_user(api: AsyncClient, fake_google):
    login = (await api.post("/api/auth/google", json={"credential": "fake"})).json()

    response = await api.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "player@example.com"


async def test_me_without_token_is_unauthorized(api: AsyncClient):
    assert (await api.get("/api/auth/me")).status_code == 401


async def test_me_with_garbage_token_is_unauthorized(api: AsyncClient):
    response = await api.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


async def test_admin_allowlist_is_case_insensitive(api: AsyncClient, fake_google, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "PLAYER@example.com , other@example.com")

    login = (await api.post("/api/auth/google", json={"credential": "fake"})).json()
    assert login["user"]["is_admin"] is True
