from datetime import date

import pytest
from httpx import AsyncClient


@pytest.fixture
def puzzle_payload():
    return {
        "theme": "פירות",
        "grid": [
            ["ת", "פ", "ו", "ח", "א", "ג", "ס", "ל"],
            ["י", "מ", "ו", "נ", "א", "ב", "ט", "י"],
            ["ח", "ע", "נ", "ב", "א", "נ", "נ", "ה"],
            ["מ", "נ", "ג", "ו", "ל", "ד", "ש", "ז"],
            ["ר", "ב", "נ", "א", "נ", "ה", "פ", "ר"],
            ["ס", "ק", "י", "ו", "י", "ב", "ל", "ה"],
        ],
        "spangram_cells": [
            {"row": 0, "col": 0}, {"row": 0, "col": 1},
            {"row": 0, "col": 2}, {"row": 0, "col": 3},
        ],
        "word_cells": [
            [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}],
            [{"row": 0, "col": 4}, {"row": 0, "col": 5}, {"row": 0, "col": 6}],
            [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}],
        ],
    }


async def test_create_puzzle_returns_derived_words(api: AsyncClient, puzzle_payload):
    response = await api.post("/api/puzzle", json=puzzle_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["theme"] == "פירות"
    assert data["spangram"] == "תפוח"
    assert data["words"] == ["תפוח", "אגס", "ימונ"]
    assert data["word_count"] == 3
    assert len(data["grid"]) == 6


async def test_get_puzzle_by_id(api: AsyncClient, puzzle_payload):
    created = (await api.post("/api/puzzle", json=puzzle_payload)).json()

    response = await api.get(f"/api/puzzle/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


async def test_get_puzzle_by_id_not_found(api: AsyncClient):
    response = await api.get("/api/puzzle/99999")
    assert response.status_code == 404


async def test_get_today_puzzle(api: AsyncClient, puzzle_payload):
    puzzle_payload["scheduled_date"] = str(date.today())
    await api.post("/api/puzzle", json=puzzle_payload)

    response = await api.get("/api/puzzle/today")
    assert response.status_code == 200
    assert response.json()["theme"] == "פירות"


async def test_get_today_puzzle_not_found(api: AsyncClient):
    response = await api.get("/api/puzzle/today")
    assert response.status_code == 404
