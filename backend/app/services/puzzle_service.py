from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.puzzle import DailySchedule, Puzzle
from app.schemas.puzzle import PuzzleCreate, PuzzlePublic
from app.services.hebrew_utils import word_from_cells


def _to_public(puzzle: Puzzle) -> PuzzlePublic:
    grid = puzzle.grid
    spangram = word_from_cells(grid, puzzle.spangram_cells)
    words = [word_from_cells(grid, cells) for cells in puzzle.word_cells]
    return PuzzlePublic(
        id=puzzle.id,
        theme=puzzle.theme,
        grid=grid,
        word_count=len(words),
        spangram=spangram,
        words=words,
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


async def create_puzzle(db: AsyncSession, data: PuzzleCreate) -> Puzzle:
    puzzle = Puzzle(
        theme=data.theme,
        grid=data.grid,
        spangram_cells=[c.model_dump() for c in data.spangram_cells],
        word_cells=[[c.model_dump() for c in word] for word in data.word_cells],
    )
    db.add(puzzle)
    await db.flush()  # get puzzle.id before committing

    if data.scheduled_date:
        existing = await db.execute(
            select(DailySchedule).where(DailySchedule.date == data.scheduled_date)
        )
        schedule = existing.scalar_one_or_none()
        if schedule:
            schedule.puzzle_id = puzzle.id
        else:
            db.add(DailySchedule(puzzle_id=puzzle.id, date=data.scheduled_date))

    await db.commit()
    await db.refresh(puzzle)
    return puzzle


def to_public(puzzle: Puzzle) -> PuzzlePublic:
    return _to_public(puzzle)
