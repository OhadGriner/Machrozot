from datetime import date
from pydantic import BaseModel


class CellPosition(BaseModel):
    row: int
    col: int


# --- Request (puzzle creation) ---

class PuzzleCreate(BaseModel):
    theme: str
    grid: list[list[str]]           # 6 rows × 8 cols
    spangram_cells: list[CellPosition]
    word_cells: list[list[CellPosition]]
    scheduled_date: date | None = None


# --- Responses ---

class PuzzlePublic(BaseModel):
    id: int
    theme: str
    grid: list[list[str]]
    word_count: int                 # number of theme words (not including spangram)
    spangram: str                   # derived word string — reveals theme span, not position
    words: list[str]                # derived word strings for client-side validation

    model_config = {"from_attributes": True}
