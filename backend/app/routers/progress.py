from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.puzzle import Puzzle
from app.models.user import GameSession, User
from app.schemas.auth import ProgressPayload, ProgressResponse

router = APIRouter(prefix="/api/progress", tags=["progress"])


async def _get_session(db: AsyncSession, user_id: int, puzzle_id: int) -> GameSession | None:
    result = await db.execute(
        select(GameSession).where(GameSession.user_id == user_id, GameSession.puzzle_id == puzzle_id)
    )
    return result.scalar_one_or_none()


@router.get("/{puzzle_id}", response_model=ProgressResponse)
async def get_progress(
    puzzle_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(db, user.id, puzzle_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No saved progress")
    return ProgressResponse(
        progress=session.progress,
        active_seconds=session.active_seconds,
        is_complete=session.is_complete,
        updated_at=session.updated_at,
    )


@router.put("/{puzzle_id}", response_model=ProgressResponse)
async def put_progress(
    puzzle_id: int,
    body: ProgressPayload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if await db.get(Puzzle, puzzle_id) is None:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    session = await _get_session(db, user.id, puzzle_id)
    if session is None:
        session = GameSession(user_id=user.id, puzzle_id=puzzle_id)
        db.add(session)
    session.progress = body.progress
    session.active_seconds = body.active_seconds
    session.is_complete = body.is_complete
    await db.commit()
    await db.refresh(session)
    return ProgressResponse(
        progress=session.progress,
        active_seconds=session.active_seconds,
        is_complete=session.is_complete,
        updated_at=session.updated_at,
    )
