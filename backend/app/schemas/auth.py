from datetime import datetime

from pydantic import BaseModel


class GoogleLoginRequest(BaseModel):
    credential: str


class UserPublic(BaseModel):
    id: int
    email: str
    name: str | None
    picture_url: str | None
    is_admin: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ProgressPayload(BaseModel):
    progress: dict
    active_seconds: int
    is_complete: bool


class ProgressResponse(ProgressPayload):
    updated_at: datetime
