import asyncio
import time
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services import puzzle_service
from app.services.hebrew_utils import Cell, word_from_cells


async def _await_shuffle(
    api: AsyncClient, puzzle_id: int, admin_headers: dict, timeout_seconds: float = 180
) -> dict:
    """Shuffle is async: POST kicks off a background job (202), the client
    polls the puzzle-scoped status endpoint until it's done or errored.
    Mirrors adminClient.ts's resume/poll flow. generate_grid's unseeded
    variance means a real (unmocked) run can legitimately take well over a
    minute, so this budgets generously rather than a fixed iteration count."""
    started = await api.post(f"/api/admin/puzzles/{puzzle_id}/shuffle", headers=admin_headers)
    assert started.status_code == 202
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    while asyncio.get_event_loop().time() < deadline:
        status = await api.get(f"/api/admin/puzzles/{puzzle_id}/shuffle-status", headers=admin_headers)
        assert status.status_code == 200
        body = status.json()
        if body["status"] != "pending":
            return body
        await asyncio.sleep(0.2)
    raise AssertionError(f"shuffle job did not complete within {timeout_seconds}s")

_ALPHABET = "אבגדהוזחטיכלמנסעפצקרשת"


def _fast_word(length: int, offset: int = 0) -> str:
    """Cycles through the alphabet — the same word-list shape
    test_grid_generator.py's test_full_roundtrip_typical_puzzle uses, proven
    to place quickly. Real (unmocked) content like the seeded יפה עיניים
    puzzle can legitimately take up to a couple of minutes per call with the
    current backtracking algorithm — too slow for routine test runs."""
    return "".join(_ALPHABET[(offset + i) % len(_ALPHABET)] for i in range(length))


@pytest.fixture
def admin_headers():
    return {"x-admin-password": settings.admin_password}


@pytest.fixture
def fake_grid_result():
    # 8 rows x 6 cols, matching the real ROWS/COLS convention (grid_generator.py) —
    # word_solver.py's solve_grid iterates the full grid assuming this exact shape.
    grid = [
        ["ת", "פ", "ו", "ח", "א", "ג"],
        ["ס", "ל", "י", "מ", "ו", "נ"],
        ["א", "ב", "ט", "י", "ח", "ע"],
        ["נ", "ב", "א", "נ", "נ", "ה"],
        ["מ", "נ", "ג", "ו", "ל", "ד"],
        ["ש", "ז", "ר", "ב", "נ", "א"],
        ["נ", "ה", "פ", "ר", "ס", "ק"],
        ["י", "ו", "י", "ב", "ל", "ה"],
    ]
    mega_machrozet_cells = [Cell(row=0, col=0), Cell(row=0, col=1), Cell(row=0, col=2), Cell(row=0, col=3)]
    word_cells = [[Cell(row=0, col=4), Cell(row=0, col=5), Cell(row=1, col=0)]]
    return grid, mega_machrozet_cells, word_cells


@pytest.fixture
def stub_generate_grid(monkeypatch, fake_grid_result):
    def fake(mega_machrozet, words):
        return fake_grid_result

    monkeypatch.setattr("app.routers.admin.generate_grid", fake)
    return fake_grid_result


async def test_list_levels_requires_admin(api: AsyncClient):
    response = await api.get("/api/admin/puzzles")
    assert response.status_code in (401, 422)  # missing header


async def test_list_levels_rejects_wrong_password(api: AsyncClient):
    response = await api.get("/api/admin/puzzles", headers={"x-admin-password": "wrong"})
    assert response.status_code == 401


async def test_create_level_returns_422_for_words_that_dont_fit_the_board(
    api: AsyncClient, admin_headers
):
    # Real (unmocked) generate_grid: total letters here (4) is nowhere near
    # the required 48, so this exercises the actual GridGenerationError path.
    response = await api.post(
        "/api/admin/puzzles",
        json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert "48" in response.json()["detail"]


async def test_create_level_persists_via_stubbed_algorithm(api: AsyncClient, admin_headers, stub_generate_grid):
    response = await api.post(
        "/api/admin/puzzles",
        json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["theme"] == "פירות"
    assert data["grid"] == stub_generate_grid[0]

    listed = await api.get("/api/admin/puzzles", headers=admin_headers)
    assert listed.status_code == 200
    entry = next(p for p in listed.json() if p["id"] == data["id"])
    assert entry["theme"] == "פירות"
    assert entry["scheduled_dates"] == []


@pytest.mark.slow
async def test_create_level_with_real_algorithm_end_to_end(api: AsyncClient, admin_headers):
    # No monkeypatching — exercises the real placement algorithm through the
    # actual HTTP endpoint. generate_grid uses the unseeded global `random`
    # module, so even this "fast" shape has real run-to-run variance.
    theme = "פירות"
    mega_machrozet = _fast_word(8)
    words = [_fast_word(n, offset=8 + i * 3) for i, n in enumerate([4, 5, 6, 6, 5, 6, 8])]

    response = await api.post(
        "/api/admin/puzzles",
        json={"theme": theme, "mega_machrozet": mega_machrozet, "words": words},
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["theme"] == theme
    assert len(data["grid"]) == 8
    assert all(len(row) == 6 for row in data["grid"])

    mega_machrozet_cells = [Cell(row=cell["row"], col=cell["col"]) for cell in data["mega_machrozet_cells"]]
    assert word_from_cells(data["grid"], mega_machrozet_cells) == mega_machrozet
    for word, cells in zip(words, data["word_cells"]):
        word_cells = [Cell(row=cell["row"], col=cell["col"]) for cell in cells]
        assert word_from_cells(data["grid"], word_cells) == word


@pytest.mark.slow
async def test_shuffle_level_rearranges_same_words_keeping_same_id(api: AsyncClient, admin_headers):
    # No monkeypatching — the shuffle endpoint must re-derive the mega_machrozet and
    # words from the puzzle's own current grid+cells and re-run the real
    # placement algorithm, landing the exact same words in (likely) different
    # cells, under the same puzzle id. generate_grid uses the unseeded global
    # `random` module, so even this "fast" shape has real run-to-run variance.
    theme = "פירות"
    mega_machrozet = _fast_word(8)
    words = [_fast_word(n, offset=8 + i * 3) for i, n in enumerate([4, 5, 6, 6, 5, 6, 8])]
    created = (
        await api.post(
            "/api/admin/puzzles",
            json={"theme": theme, "mega_machrozet": mega_machrozet, "words": words},
            headers=admin_headers,
        )
    ).json()

    result = await _await_shuffle(api, created["id"], admin_headers)
    assert result["status"] == "done"
    data = result["puzzle"]
    assert data["id"] == created["id"]
    assert data["theme"] == theme

    mega_machrozet_cells = [Cell(row=cell["row"], col=cell["col"]) for cell in data["mega_machrozet_cells"]]
    assert word_from_cells(data["grid"], mega_machrozet_cells) == mega_machrozet
    for word, cells in zip(words, data["word_cells"]):
        word_cells = [Cell(row=cell["row"], col=cell["col"]) for cell in cells]
        assert word_from_cells(data["grid"], word_cells) == word


async def test_shuffle_level_updates_the_calendar_pointer(
    api: AsyncClient, admin_headers, stub_generate_grid, monkeypatch
):
    # The calendar looks up a day's puzzle by id via the schedule table, so
    # shuffling (which mutates the same puzzle row) must be visible there
    # without touching the schedule itself.
    created = (
        await api.post(
            "/api/admin/puzzles",
            json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
            headers=admin_headers,
        )
    ).json()
    await api.post(
        "/api/admin/schedule/2026-07-20", json={"puzzle_id": created["id"]}, headers=admin_headers
    )

    def different_layout(mega_machrozet, words):
        grid, mega_machrozet_cells, word_cells = stub_generate_grid
        reversed_grid = [list(reversed(row)) for row in grid]
        return reversed_grid, mega_machrozet_cells, word_cells

    monkeypatch.setattr("app.routers.admin.generate_grid", different_layout)
    result = await _await_shuffle(api, created["id"], admin_headers)
    assert result["status"] == "done"

    scheduled = await api.get("/api/admin/schedule/2026-07-20", headers=admin_headers)
    assert scheduled.status_code == 200
    assert scheduled.json()["id"] == created["id"]
    assert scheduled.json()["grid"] == result["puzzle"]["grid"]
    assert scheduled.json()["grid"] != stub_generate_grid[0]


async def test_shuffle_level_not_found(api: AsyncClient, admin_headers):
    response = await api.post("/api/admin/puzzles/99999/shuffle", headers=admin_headers)
    assert response.status_code == 404


async def test_shuffle_status_is_none_before_any_shuffle(
    api: AsyncClient, admin_headers, stub_generate_grid
):
    created = (
        await api.post(
            "/api/admin/puzzles",
            json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
            headers=admin_headers,
        )
    ).json()

    response = await api.get(f"/api/admin/puzzles/{created['id']}/shuffle-status", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "none"


async def test_shuffle_reports_elapsed_time_and_resumes_without_duplicating_work(
    api: AsyncClient, admin_headers, stub_generate_grid, monkeypatch
):
    # A slow, call-counted stand-in for generate_grid — lets us assert the
    # second POST (simulating the admin navigating away and back, or a page
    # reload, while a shuffle is still running) resumes watching the same
    # job instead of kicking off a wasteful duplicate placement run.
    created = (
        await api.post(
            "/api/admin/puzzles",
            json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
            headers=admin_headers,
        )
    ).json()

    call_count = 0

    def slow(mega_machrozet, words):
        nonlocal call_count
        call_count += 1
        time.sleep(0.3)
        return stub_generate_grid

    monkeypatch.setattr("app.routers.admin.generate_grid", slow)

    first = await api.post(f"/api/admin/puzzles/{created['id']}/shuffle", headers=admin_headers)
    assert first.status_code == 202
    assert first.json()["status"] == "pending"

    await asyncio.sleep(0.05)
    second = await api.post(f"/api/admin/puzzles/{created['id']}/shuffle", headers=admin_headers)
    assert second.status_code == 202
    assert second.json()["status"] == "pending"
    assert second.json()["elapsed_seconds"] > 0

    result = await _await_shuffle(api, created["id"], admin_headers)
    assert result["status"] == "done"
    assert result["elapsed_seconds"] > 0
    assert call_count == 1  # the second POST resumed the same job, not a fresh one


async def test_shuffle_level_propagates_grid_generation_error(
    api: AsyncClient, admin_headers, stub_generate_grid, monkeypatch
):
    created = (
        await api.post(
            "/api/admin/puzzles",
            json={"theme": "פירות", "mega_machrozet": "תפוח", "words": ["אגס"]},
            headers=admin_headers,
        )
    ).json()

    def fail(mega_machrozet, words):
        from app.services.grid_generator import GridGenerationError
        raise GridGenerationError("no valid layout")

    monkeypatch.setattr("app.routers.admin.generate_grid", fail)
    result = await _await_shuffle(api, created["id"], admin_headers)
    assert result["status"] == "error"
    assert result["detail"] == "no valid layout"


async def test_list_puzzles_includes_scheduled_dates(
    api: AsyncClient, admin_headers, db_session: AsyncSession, fake_grid_result
):
    grid, mega_machrozet_cells, word_cells = fake_grid_result
    puzzle = await puzzle_service.create_puzzle(db_session, "פירות", grid, mega_machrozet_cells, word_cells)
    await puzzle_service.assign_schedule(db_session, puzzle.id, date(2026, 5, 1))
    await puzzle_service.assign_schedule(db_session, puzzle.id, date(2026, 5, 2))

    listed = await api.get("/api/admin/puzzles", headers=admin_headers)
    entry = next(p for p in listed.json() if p["id"] == puzzle.id)
    assert entry["scheduled_dates"] == ["2026-05-01", "2026-05-02"]


async def test_get_level_not_found(api: AsyncClient, admin_headers):
    response = await api.get("/api/admin/puzzles/99999", headers=admin_headers)
    assert response.status_code == 404


async def test_delete_level_removes_puzzle_and_its_schedules(
    api: AsyncClient, admin_headers, db_session: AsyncSession, fake_grid_result
):
    grid, mega_machrozet_cells, word_cells = fake_grid_result
    puzzle = await puzzle_service.create_puzzle(db_session, "פירות", grid, mega_machrozet_cells, word_cells)
    await puzzle_service.assign_schedule(db_session, puzzle.id, date(2026, 6, 1))

    response = await api.delete(f"/api/admin/puzzles/{puzzle.id}", headers=admin_headers)
    assert response.status_code == 204

    assert (await api.get(f"/api/admin/puzzles/{puzzle.id}", headers=admin_headers)).status_code == 404
    assert (await api.get("/api/admin/schedule/2026-06-01", headers=admin_headers)).status_code == 404


async def test_delete_level_not_found(api: AsyncClient, admin_headers):
    response = await api.delete("/api/admin/puzzles/99999", headers=admin_headers)
    assert response.status_code == 404


async def test_schedule_assign_and_get(api: AsyncClient, admin_headers, db_session: AsyncSession, fake_grid_result):
    grid, mega_machrozet_cells, word_cells = fake_grid_result
    puzzle = await puzzle_service.create_puzzle(db_session, "פירות", grid, mega_machrozet_cells, word_cells)

    assign = await api.post(
        "/api/admin/schedule/2026-01-15",
        json={"puzzle_id": puzzle.id},
        headers=admin_headers,
    )
    assert assign.status_code == 204

    fetched = await api.get("/api/admin/schedule/2026-01-15", headers=admin_headers)
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["id"] == puzzle.id
    assert body["theme"] == "פירות"
    assert body["grid"] == grid
    assert body["mega_machrozet_cells"] == [{"row": cell.row, "col": cell.col} for cell in mega_machrozet_cells]


async def test_schedule_get_not_found(api: AsyncClient, admin_headers):
    response = await api.get("/api/admin/schedule/2026-02-01", headers=admin_headers)
    assert response.status_code == 404


async def test_schedule_assign_unknown_puzzle(api: AsyncClient, admin_headers):
    response = await api.post(
        "/api/admin/schedule/2026-03-01",
        json={"puzzle_id": 99999},
        headers=admin_headers,
    )
    assert response.status_code == 404


async def test_same_level_can_be_scheduled_on_multiple_dates(
    api: AsyncClient, admin_headers, db_session: AsyncSession, fake_grid_result
):
    grid, mega_machrozet_cells, word_cells = fake_grid_result
    puzzle = await puzzle_service.create_puzzle(db_session, "פירות", grid, mega_machrozet_cells, word_cells)

    first = await api.post("/api/admin/schedule/2026-04-01", json={"puzzle_id": puzzle.id}, headers=admin_headers)
    second = await api.post("/api/admin/schedule/2026-04-02", json={"puzzle_id": puzzle.id}, headers=admin_headers)
    assert first.status_code == 204
    assert second.status_code == 204


async def test_schedule_unassign_removes_only_that_date(
    api: AsyncClient, admin_headers, db_session: AsyncSession, fake_grid_result
):
    grid, mega_machrozet_cells, word_cells = fake_grid_result
    puzzle = await puzzle_service.create_puzzle(db_session, "פירות", grid, mega_machrozet_cells, word_cells)
    await puzzle_service.assign_schedule(db_session, puzzle.id, date(2026, 5, 10))
    await puzzle_service.assign_schedule(db_session, puzzle.id, date(2026, 5, 11))

    response = await api.delete("/api/admin/schedule/2026-05-10", headers=admin_headers)
    assert response.status_code == 204

    assert (await api.get("/api/admin/schedule/2026-05-10", headers=admin_headers)).status_code == 404
    # the other date, and the underlying puzzle itself, are untouched
    assert (await api.get("/api/admin/schedule/2026-05-11", headers=admin_headers)).status_code == 200
    assert (await api.get(f"/api/admin/puzzles/{puzzle.id}", headers=admin_headers)).status_code == 200


async def test_schedule_unassign_not_found(api: AsyncClient, admin_headers):
    response = await api.delete("/api/admin/schedule/2026-06-15", headers=admin_headers)
    assert response.status_code == 404
