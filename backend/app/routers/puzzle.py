from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin_user
from app.models.user import User
from app.schemas.puzzle import PuzzleCreate, PuzzlePublic
from app.services import puzzle_service
from app.services.hebrew_utils import Cell

router = APIRouter(prefix="/api/puzzle", tags=["puzzle"])


@router.get("/today", response_model=PuzzlePublic)
async def get_today(db: AsyncSession = Depends(get_db)):
    puzzle = await puzzle_service.get_today_puzzle(db)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle scheduled for today")
    return puzzle_service.to_public(puzzle)


@router.get("/date/{schedule_date}", response_model=PuzzlePublic)
async def get_by_date(schedule_date: date, db: AsyncSession = Depends(get_db)):
    # A puzzle can be scheduled ahead of time, so without this guard the
    # archive route would let players fetch (and spoil) a future day's
    # answers early just by editing the URL's date.
    if schedule_date > date.today():
        raise HTTPException(status_code=404, detail="No puzzle scheduled for this date")
    puzzle = await puzzle_service.get_scheduled_puzzle(db, schedule_date)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle scheduled for this date")
    return puzzle_service.to_public(puzzle)


@router.get("/{puzzle_id}", response_model=PuzzlePublic)
async def get_by_id(puzzle_id: int, db: AsyncSession = Depends(get_db)):
    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return puzzle_service.to_public(puzzle)


@router.post("", response_model=PuzzlePublic, status_code=201)
async def create(
    data: PuzzleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    puzzle = await puzzle_service.create_puzzle(
        db,
        data.theme,
        data.grid,
        [Cell(row=cell.row, col=cell.col) for cell in data.mega_machrozet_cells],
        [
            [Cell(row=cell.row, col=cell.col) for cell in word]
            for word in data.word_cells
        ],
    )
    if data.scheduled_date:
        await puzzle_service.assign_schedule(db, puzzle.id, data.scheduled_date)
    return puzzle_service.to_public(puzzle)
