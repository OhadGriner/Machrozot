from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.puzzle import DailySchedule, Puzzle
from app.schemas.puzzle import PuzzleCreate
from app.services.puzzle_service import create_puzzle, to_public

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(x_admin_password: str = Header()):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/schedules")
async def list_schedules(
    start: date,
    end: date,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
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


@router.get("/puzzle/{puzzle_date}")
async def get_puzzle_admin(
    puzzle_date: date,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    result = await db.execute(
        select(Puzzle)
        .join(DailySchedule, DailySchedule.puzzle_id == Puzzle.id)
        .where(DailySchedule.date == puzzle_date)
    )
    puzzle = result.scalar_one_or_none()
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle for this date")
    return {
        "id": puzzle.id,
        "theme": puzzle.theme,
        "grid": puzzle.grid,
        "spangram_cells": puzzle.spangram_cells,
        "word_cells": puzzle.word_cells,
    }


@router.post("/puzzle/{puzzle_date}", status_code=201)
async def save_puzzle(
    puzzle_date: date,
    data: PuzzleCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    data.scheduled_date = puzzle_date
    puzzle = await create_puzzle(db, data)
    return to_public(puzzle)
