from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackPublic

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackPublic, status_code=201)
async def create(data: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    feedback = Feedback(message=data.message, contact=data.contact, context=data.context)
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback