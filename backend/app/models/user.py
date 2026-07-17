from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Google's stable account identifier ("sub" claim) — the identity anchor;
    # email/name/picture are refreshed from Google on every login.
    google_sub: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    picture_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class GameSession(Base):
    __tablename__ = "game_sessions"
    __table_args__ = (UniqueConstraint("user_id", "puzzle_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), nullable=False)
    # The frontend's SavedProgress blob (found words, cell states, solve order…)
    # — stored opaquely; the server never re-validates game moves.
    progress: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    active_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
