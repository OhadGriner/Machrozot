from dataclasses import asdict
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.puzzle import DailySchedule, Puzzle
from app.schemas.puzzle import PuzzlePublic
from app.services.hebrew_utils import Cell, normalize_word, word_from_cells


def _to_public(puzzle: Puzzle) -> PuzzlePublic:
    grid = puzzle.grid
    mega_machrozet_cells = [Cell(**c) for c in puzzle.mega_machrozet_cells]
    word_cell_lists = [[Cell(**c) for c in cells] for cells in puzzle.word_cells]
    mega_machrozet = word_from_cells(grid, mega_machrozet_cells)
    words = [word_from_cells(grid, cells) for cells in word_cell_lists]
    return PuzzlePublic(
        id=puzzle.id,
        theme=puzzle.theme,
        grid=grid,
        word_count=len(words),
        mega_machrozet=mega_machrozet,
        words=words,
        mega_machrozet_cells=puzzle.mega_machrozet_cells,
        word_cells=puzzle.word_cells,
        # Normalized here so the client only ever needs to normalize its own
        # side of the comparison (the dragged selection) to check membership.
        bonus_words=[normalize_word(w) for w in puzzle.bonus_words],
    )


async def get_puzzle_by_id(db: AsyncSession, puzzle_id: int) -> Puzzle | None:
    result = await db.execute(select(Puzzle).where(Puzzle.id == puzzle_id))
    return result.scalar_one_or_none()


async def get_today_puzzle(db: AsyncSession) -> Puzzle | None:
    today = date.today()
    result = await db.execute(
        select(Puzzle)
        .join(DailySchedule, DailySchedule.puzzle_id == Puzzle.id)
        .where(DailySchedule.date == today)
    )
    return result.scalar_one_or_none()


async def create_puzzle(
    db: AsyncSession,
    theme: str,
    grid: list[list[str]],
    mega_machrozet_cells: list[Cell],
    word_cells: list[list[Cell]],
    bonus_words: list[str] | None = None,
) -> Puzzle:
    puzzle = Puzzle(
        theme=theme,
        grid=grid,
        mega_machrozet_cells=[asdict(c) for c in mega_machrozet_cells],
        word_cells=[[asdict(c) for c in cells] for cells in word_cells],
        bonus_words=bonus_words or [],
    )
    db.add(puzzle)
    await db.commit()
    await db.refresh(puzzle)
    return puzzle


async def update_puzzle_grid(
    db: AsyncSession,
    puzzle: Puzzle,
    grid: list[list[str]],
    mega_machrozet_cells: list[Cell],
    word_cells: list[list[Cell]],
    bonus_words: list[str] | None = None,
) -> Puzzle:
    """Overwrite `puzzle`'s layout in place (same id) — used by "shuffle" to
    re-arrange the same words on the board. Keeping the id means every
    DailySchedule pointing at this puzzle (the calendar) picks up the new
    layout automatically, with no need to touch any schedule row."""
    puzzle.grid = grid
    puzzle.mega_machrozet_cells = [asdict(c) for c in mega_machrozet_cells]
    puzzle.word_cells = [[asdict(c) for c in cells] for cells in word_cells]
    puzzle.bonus_words = bonus_words or []
    await db.commit()
    await db.refresh(puzzle)
    return puzzle


async def delete_puzzle(db: AsyncSession, puzzle: Puzzle) -> None:
    await db.execute(delete(DailySchedule).where(DailySchedule.puzzle_id == puzzle.id))
    await db.delete(puzzle)
    await db.commit()


async def assign_schedule(db: AsyncSession, puzzle_id: int, schedule_date: date) -> None:
    existing = await db.execute(
        select(DailySchedule).where(DailySchedule.date == schedule_date)
    )
    schedule = existing.scalar_one_or_none()
    if schedule:
        schedule.puzzle_id = puzzle_id
    else:
        db.add(DailySchedule(puzzle_id=puzzle_id, date=schedule_date))
    await db.commit()


async def get_scheduled_puzzle(db: AsyncSession, schedule_date: date) -> Puzzle | None:
    result = await db.execute(
        select(Puzzle)
        .join(DailySchedule, DailySchedule.puzzle_id == Puzzle.id)
        .where(DailySchedule.date == schedule_date)
    )
    return result.scalar_one_or_none()


async def unassign_schedule(db: AsyncSession, schedule_date: date) -> bool:
    """Remove the schedule entry for `schedule_date`, if any. The underlying
    puzzle is left intact — it may still be scheduled on other dates."""
    result = await db.execute(delete(DailySchedule).where(DailySchedule.date == schedule_date))
    await db.commit()
    return result.rowcount > 0


def to_public(puzzle: Puzzle) -> PuzzlePublic:
    return _to_public(puzzle)
