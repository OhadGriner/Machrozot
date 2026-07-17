import asyncio
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


async def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token and return its claims (sub, email, name, picture).

    google-auth is synchronous (it may fetch Google's certs over HTTP), so it
    runs in a thread to keep the event loop free.
    """
    try:
        return await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")


async def get_or_create_user(
    db: AsyncSession, *, google_sub: str, email: str, name: str | None, picture_url: str | None
) -> User:
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(google_sub=google_sub, email=email, name=name, picture_url=picture_url)
        db.add(user)
    else:
        user.email = email
        user.name = name
        user.picture_url = picture_url
    await db.commit()
    await db.refresh(user)
    return user


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def is_admin_email(email: str | None) -> bool:
    return bool(email) and email.lower() in settings.admin_email_list
