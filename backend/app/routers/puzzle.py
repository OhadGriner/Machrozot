from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.puzzle import PuzzleCreate, PuzzlePublic
from app.services import puzzle_service

router = APIRouter(prefix="/api/puzzle", tags=["puzzle"])


@router.get("/today", response_model=PuzzlePublic)
async def get_today(db: AsyncSession = Depends(get_db)):
    puzzle = await puzzle_service.get_today_puzzle(db)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle scheduled for today")
    return puzzle_service.to_public(puzzle)


@router.get("/{puzzle_id}", response_model=PuzzlePublic)
async def get_by_id(puzzle_id: int, db: AsyncSession = Depends(get_db)):
    puzzle = await puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return puzzle_service.to_public(puzzle)


@router.post("", response_model=PuzzlePublic, status_code=201)
async def create(data: PuzzleCreate, db: AsyncSession = Depends(get_db)):
    puzzle = await puzzle_service.create_puzzle(db, data)
    return puzzle_service.to_public(puzzle)
