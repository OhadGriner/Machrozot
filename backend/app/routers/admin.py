import asyncio
import time
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from app.database import AsyncSessionLocal, get_db
from app.dependencies import require_admin_user
from app.models.puzzle import DailySchedule, Puzzle
from app.models.user import User
from app.schemas.puzzle import PuzzleGridDetail, PuzzleSummary, PuzzleWordsCreate, ScheduleAssign
from app.services import job_store, puzzle_service, word_solver
from app.services.grid_generator import GridGenerationError, generate_grid
from app.services.hebrew_utils import Cell

router = APIRouter(prefix="/api/admin", tags=["admin"])

# asyncio only holds a *weak* reference to a task once nothing else references
# it — a bare `asyncio.create_task(...)` can get garbage-collected mid-flight
# (more likely under real memory pressure, e.g. production) and silently never
# run to completion, leaving its job stuck at "pending" forever. Keep a strong
# reference here until each task finishes.
_background_tasks: set[asyncio.Task] = set()


def _spawn_background(coro) -> None:
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _generate_and_solve(
    mega_machrozet: str, words: list[str]
) -> tuple[list[list[str]], list[Cell], list[list[Cell]], list[str]]:
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    bonus_words = word_solver.solve_grid(grid, {mega_machrozet, *words})
    return grid, mega_machrozet_cells, word_cells, bonus_words


@router.get("/schedules")
async def list_schedules(
    start: date,
    end: date,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    result = await db.execute(
        select(DailySchedule, Puzzle.theme)
        .join(Puzzle, Puzzle.id == DailySchedule.puzzle_id)
        .where(DailySchedule.date >= start, DailySchedule.date <= end)
    )
    return [
        {"date": str(row.DailySchedule.date), "puzzle_id": row.DailySchedule.puzzle_id, "theme": row.theme}
        for row in result
    ]


@router.get("/puzzles", response_model=list[PuzzleSummary])
async def list_puzzles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzles = await db.execute(select(Puzzle.id, Puzzle.theme))
    schedules = await db.execute(select(DailySchedule.puzzle_id, DailySchedule.date))
    dates_by_puzzle: dict[int, list[str]] = {}
    for row in schedules:
        dates_by_puzzle.setdefault(row.puzzle_id, []).append(str(row.date))
    return [
        PuzzleSummary(id=row.id, theme=row.theme, scheduled_dates=sorted(dates_by_puzzle.get(row.id, [])))
        for row in puzzles
    ]


@router.post("/puzzles", response_model=PuzzleGridDetail, status_code=201)
async def create_level(
    data: PuzzleWordsCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    try:
        grid, mega_machrozet_cells, word_cells, bonus_words = await asyncio.to_thread(
            _generate_and_solve, data.mega_machrozet, data.words
        )
    except GridGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    puzzle = await puzzle_service.create_puzzle(
        db, data.theme, grid, mega_machrozet_cells, word_cells, bonus_words
    )
    return puzzle


@router.get("/puzzles/{puzzle_id}", response_model=PuzzleGridDetail)
async def get_level(
    puzzle_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return puzzle


class ShuffleJobStatus(BaseModel):
    status: str  # "none" | "pending" | "done" | "error"
    elapsed_seconds: float = 0
    puzzle: PuzzleGridDetail | None = None
    detail: str = ""


def _shuffle_status_response(job: job_store.Job | None) -> ShuffleJobStatus:
    if job is None:
        return ShuffleJobStatus(status="none")
    elapsed = time.time() - job.started_at
    if job.status == "error":
        return ShuffleJobStatus(status="error", elapsed_seconds=elapsed, detail=job.detail)
    if job.status == "done":
        return ShuffleJobStatus(status="done", elapsed_seconds=elapsed, puzzle=job.result)
    return ShuffleJobStatus(status="pending", elapsed_seconds=elapsed)


async def _run_shuffle(job_id: str, puzzle_id: int, mega_machrozet: str, words: list[str]) -> None:
    try:
        try:
            grid, mega_machrozet_cells, word_cells, bonus_words = await asyncio.to_thread(
                _generate_and_solve, mega_machrozet, words
            )
        except GridGenerationError as e:
            job_store.fail_job(job_id, str(e))
            return
        async with AsyncSessionLocal() as db:
            puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
            if not puzzle:
                job_store.fail_job(job_id, "Puzzle not found")
                return
            updated = await puzzle_service.update_puzzle_grid(
                db, puzzle, grid, mega_machrozet_cells, word_cells, bonus_words
            )
            job_store.resolve_job(job_id, PuzzleGridDetail.model_validate(updated))
    except Exception as e:  # noqa: BLE001 — a job stuck at "pending" forever is worse than a broad catch
        job_store.fail_job(job_id, f"Unexpected error: {e}")


@router.post("/puzzles/{puzzle_id}/shuffle", response_model=ShuffleJobStatus, status_code=202)
async def shuffle_level(
    puzzle_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    # If a shuffle is already running for this puzzle (e.g. the admin
    # navigated away and came back and clicked again), just resume watching
    # it instead of kicking off a wasteful duplicate generate_grid run.
    existing = job_store.get_latest_job_for_puzzle(puzzle_id)
    if existing is not None and existing.status == "pending":
        return _shuffle_status_response(existing)

    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    public = puzzle_service.to_public(puzzle)
    job_id = job_store.create_job(puzzle_id)
    _spawn_background(_run_shuffle(job_id, puzzle_id, public.mega_machrozet, public.words))
    return _shuffle_status_response(job_store.get_job(job_id))


@router.get("/puzzles/{puzzle_id}/shuffle-status", response_model=ShuffleJobStatus)
async def get_shuffle_status(
    puzzle_id: int,
    _: User = Depends(require_admin_user),
):
    """State of the most recent shuffle job for this puzzle, if any — lets the
    admin UI show elapsed time and resume watching progress after a page
    reload or navigating away and back, without needing a remembered job_id."""
    job = job_store.get_latest_job_for_puzzle(puzzle_id)
    return _shuffle_status_response(job)


@router.delete("/puzzles/{puzzle_id}", status_code=204)
async def delete_level(
    puzzle_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    await puzzle_service.delete_puzzle(db, puzzle)


@router.get("/schedule/{schedule_date}", response_model=PuzzleGridDetail)
async def get_schedule(
    schedule_date: date,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzle = await puzzle_service.get_scheduled_puzzle(db, schedule_date)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle scheduled for this date")
    return puzzle


@router.post("/schedule/{schedule_date}", status_code=204)
async def set_schedule(
    schedule_date: date,
    data: ScheduleAssign,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzle = await puzzle_service.get_puzzle_by_id(db, data.puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    await puzzle_service.assign_schedule(db, data.puzzle_id, schedule_date)


@router.delete("/schedule/{schedule_date}", status_code=204)
async def unassign_schedule(
    schedule_date: date,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    removed = await puzzle_service.unassign_schedule(db, schedule_date)
    if not removed:
        raise HTTPException(status_code=404, detail="No puzzle scheduled for this date")
