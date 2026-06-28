from datetime import UTC, date, datetime

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class Puzzle(Base):
    __tablename__ = "puzzles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    theme: Mapped[str] = mapped_column(String, nullable=False)
    # 6×8 grid of bare Hebrew consonants, e.g. [["א","ב",...], ...]
    grid: Mapped[list] = mapped_column(JSON, nullable=False)
    # Ordered cell positions [{row, col}, ...] that spell the spangram
    spangram_cells: Mapped[list] = mapped_column(JSON, nullable=False)
    # One ordered cell list per theme word: [[{row,col},...], ...]
    word_cells: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC))
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)

    daily_schedules: Mapped[list["DailySchedule"]] = relationship(back_populates="puzzle")


class DailySchedule(Base):
    __tablename__ = "daily_schedule"
    __table_args__ = (UniqueConstraint("date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    puzzle: Mapped["Puzzle"] = relationship(back_populates="daily_schedules")
