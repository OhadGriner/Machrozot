import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import GameSession, User
from app.services.auth_service import create_access_token


@pytest.fixture
async def user_headers(db_session: AsyncSession):
    user = User(google_sub="sub-a", email="a@example.com", name="A", picture_url=None)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
async def other_user_headers(db_session: AsyncSession):
    user = User(google_sub="sub-b", email="b@example.com", name="B", picture_url=None)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
async def puzzle_id(api: AsyncClient, admin_headers):
    payload = {
        "theme": "פירות",
        "grid": [["ת", "פ", "ו", "ח"]],
        "mega_machrozet_cells": [
            {"row": 0, "col": 0}, {"row": 0, "col": 1},
            {"row": 0, "col": 2}, {"row": 0, "col": 3},
        ],
        "word_cells": [
            [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}],
        ],
    }
    response = await api.post("/api/puzzle", json=payload, headers=admin_headers)
    assert response.status_code == 201
    return response.json()["id"]


PROGRESS = {
    "progress": {"foundWords": ["תפוח"], "cellStates": {"0-0": "found"}},
    "active_seconds": 90,
    "is_complete": False,
}


async def test_get_before_any_save_is_404(api: AsyncClient, user_headers, puzzle_id):
    response = await api.get(f"/api/progress/{puzzle_id}", headers=user_headers)
    assert response.status_code == 404


async def test_put_then_get_roundtrip(api: AsyncClient, user_headers, puzzle_id):
    put = await api.put(f"/api/progress/{puzzle_id}", json=PROGRESS, headers=user_headers)
    assert put.status_code == 200

    got = (await api.get(f"/api/progress/{puzzle_id}", headers=user_headers)).json()
    assert got["progress"] == PROGRESS["progress"]
    assert got["active_seconds"] == 90
    assert got["is_complete"] is False


async def test_second_put_updates_the_same_row(
    api: AsyncClient, user_headers, puzzle_id, db_session: AsyncSession
):
    await api.put(f"/api/progress/{puzzle_id}", json=PROGRESS, headers=user_headers)
    updated = {**PROGRESS, "active_seconds": 200, "is_complete": True}
    await api.put(f"/api/progress/{puzzle_id}", json=updated, headers=user_headers)

    count = (await db_session.execute(select(func.count(GameSession.id)))).scalar_one()
    assert count == 1
    got = (await api.get(f"/api/progress/{puzzle_id}", headers=user_headers)).json()
    assert got["active_seconds"] == 200
    assert got["is_complete"] is True


async def test_progress_requires_auth(api: AsyncClient, puzzle_id):
    assert (await api.get(f"/api/progress/{puzzle_id}")).status_code == 401
    assert (await api.put(f"/api/progress/{puzzle_id}", json=PROGRESS)).status_code == 401


async def test_users_cannot_see_each_others_progress(
    api: AsyncClient, user_headers, other_user_headers, puzzle_id
):
    await api.put(f"/api/progress/{puzzle_id}", json=PROGRESS, headers=user_headers)

    response = await api.get(f"/api/progress/{puzzle_id}", headers=other_user_headers)
    assert response.status_code == 404


async def test_put_for_unknown_puzzle_is_404(api: AsyncClient, user_headers):
    response = await api.put("/api/progress/999999", json=PROGRESS, headers=user_headers)
    assert response.status_code == 404
