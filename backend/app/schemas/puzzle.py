from datetime import date
from pydantic import BaseModel


class CellPosition(BaseModel):
    row: int
    col: int


# --- Request (puzzle creation) ---

class PuzzleCreate(BaseModel):
    theme: str
    grid: list[list[str]]           # 8 rows × 6 cols
    mega_machrozet_cells: list[CellPosition]
    word_cells: list[list[CellPosition]]
    scheduled_date: date | None = None


class PuzzleWordsCreate(BaseModel):
    theme: str
    mega_machrozet: str
    words: list[str]


class ScheduleAssign(BaseModel):
    puzzle_id: int


# --- Responses ---

class PuzzleSummary(BaseModel):
    id: int
    theme: str
    scheduled_dates: list[str] = []

    model_config = {"from_attributes": True}


class PuzzleGridDetail(BaseModel):
    id: int
    theme: str
    grid: list[list[str]]
    mega_machrozet_cells: list[CellPosition]
    word_cells: list[list[CellPosition]]

    model_config = {"from_attributes": True}


class PuzzlePublic(BaseModel):
    id: int
    theme: str
    grid: list[list[str]]
    word_count: int                 # number of theme words (not including the mega machrozet)
    mega_machrozet: str              # derived word string, for display (e.g. hint UI)
    words: list[str]                # derived word strings, for display
    mega_machrozet_cells: list[CellPosition]   # ordered path — client validates selection by position+order
    word_cells: list[list[CellPosition]]
    bonus_words: list[str]               # real dictionary words also on the grid, for hint-earning gating

    model_config = {"from_attributes": True}
