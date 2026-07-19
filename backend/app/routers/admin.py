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
from app.services.grid_generator import GridGenerationError, generate_grid, validate_word_set
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


class AdminJobStatus(BaseModel):
    job_id: str = ""
    kind: str = ""  # "create" | "shuffle"
    status: str = "none"  # "none" | "pending" | "done" | "error"
    puzzle_id: int | None = None
    elapsed_seconds: float = 0
    theme: str = ""
    mega_machrozet: str = ""
    words: list[str] = []
    puzzle: PuzzleGridDetail | None = None
    detail: str = ""


def _job_status_response(job_id: str, job: job_store.Job | None) -> AdminJobStatus:
    if job is None:
        return AdminJobStatus()
    return AdminJobStatus(
        job_id=job_id,
        kind=job.kind,
        status=job.status,
        puzzle_id=job.puzzle_id,
        elapsed_seconds=time.time() - job.started_at,
        theme=job.theme,
        mega_machrozet=job.mega_machrozet,
        words=job.words,
        puzzle=job.result if job.status == "done" else None,
        detail=job.detail,
    )


async def _run_generation(job_id: str, puzzle_id: int, mega_machrozet: str, words: list[str]) -> None:
    """Shared background worker for both creation and shuffle: generate a grid
    for the words and write it onto the existing puzzle row in place. (A newly
    created level's row already exists with an empty grid — creation is just
    the first fill.)"""
    try:
        try:
            grid, mega_machrozet_cells, word_cells, bonus_words = await asyncio.to_thread(
                _generate_and_solve, mega_machrozet, words
            )
        except GridGenerationError as e:
            job_store.fail_job(job_id, str(e))
            return
        # Own session: the request that spawned this job returned long ago.
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


@router.post("/puzzles", response_model=AdminJobStatus, status_code=202)
async def create_level(
    data: PuzzleWordsCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    """Create the level's row immediately (empty grid) and fill the grid in a
    background job — generation can take minutes, and holding the HTTP request
    open that long made the browser give up with a fetch error while the
    server kept going. The new level shows up in GET /puzzles right away, with
    its generation progress visible via GET /jobs and the per-puzzle status
    endpoint."""
    try:
        # Deterministic failures (wrong letter count, embedded words) reject
        # synchronously so the editor shows them inline instead of as a
        # doomed background job.
        validate_word_set(data.mega_machrozet, data.words)
    except GridGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    puzzle = await puzzle_service.create_puzzle(db, data.theme, [], [], [], [])
    job_id = job_store.create_job(
        "create", puzzle_id=puzzle.id, theme=data.theme,
        mega_machrozet=data.mega_machrozet, words=data.words,
    )
    _spawn_background(_run_generation(job_id, puzzle.id, data.mega_machrozet, data.words))
    return _job_status_response(job_id, job_store.get_job(job_id))


@router.get("/jobs", response_model=list[AdminJobStatus])
async def list_jobs(_: User = Depends(require_admin_user)):
    """Every generation/shuffle job still worth showing: pending ones (with
    live elapsed time) and errors (until dismissed). Done jobs are excluded —
    a finished creation simply shows up in the regular levels list."""
    return [
        _job_status_response(job_id, job)
        for job_id, job in job_store.list_jobs()
        if job.status in ("pending", "error")
    ]


@router.delete("/jobs/{job_id}", status_code=204)
async def dismiss_job(job_id: str, _: User = Depends(require_admin_user)):
    if not job_store.discard_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")


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


@router.post("/puzzles/{puzzle_id}/shuffle", response_model=AdminJobStatus, status_code=202)
async def shuffle_level(
    puzzle_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    # If a generation is already running for this puzzle (e.g. the admin
    # navigated away and came back and clicked again), just resume watching
    # it instead of kicking off a wasteful duplicate generate_grid run.
    existing_id, existing = job_store.get_latest_job_entry_for_puzzle(puzzle_id)
    if existing is not None and existing.status == "pending":
        return _job_status_response(existing_id, existing)

    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    public = puzzle_service.to_public(puzzle)
    job_id = job_store.create_job(
        "shuffle", puzzle_id=puzzle_id, theme=puzzle.theme,
        mega_machrozet=public.mega_machrozet, words=public.words,
    )
    _spawn_background(_run_generation(job_id, puzzle_id, public.mega_machrozet, public.words))
    return _job_status_response(job_id, job_store.get_job(job_id))


@router.get("/puzzles/{puzzle_id}/shuffle-status", response_model=AdminJobStatus)
async def get_shuffle_status(
    puzzle_id: int,
    _: User = Depends(require_admin_user),
):
    """State of the most recent generation job (creation or shuffle) for this
    puzzle, if any — lets the admin UI show elapsed time and resume watching
    progress after a page reload or navigating away and back, without needing
    a remembered job_id."""
    job_id, job = job_store.get_latest_job_entry_for_puzzle(puzzle_id)
    return _job_status_response(job_id or "", job)


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
