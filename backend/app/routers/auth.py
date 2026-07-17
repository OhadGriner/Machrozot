from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import GoogleLoginRequest, TokenResponse, UserPublic
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        picture_url=user.picture_url,
        is_admin=auth_service.is_admin_email(user.email),
    )


@router.post("/google", response_model=TokenResponse)
async def login_with_google(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    claims = await auth_service.verify_google_token(body.credential)
    user = await auth_service.get_or_create_user(
        db,
        google_sub=claims["sub"],
        email=claims["email"],
        name=claims.get("name"),
        picture_url=claims.get("picture"),
    )
    return TokenResponse(access_token=auth_service.create_access_token(user), user=_to_public(user))


@router.get("/me", response_model=UserPublic)
async def get_me(user: User = Depends(get_current_user)):
    return _to_public(user)
