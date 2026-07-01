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
    spangram: str                   # derived word string, for display (e.g. hint UI)
    words: list[str]                # derived word strings, for display
    spangram_cells: list[CellPosition]   # ordered path — client validates selection by position+order
    word_cells: list[list[CellPosition]]

    model_config = {"from_attributes": True}
