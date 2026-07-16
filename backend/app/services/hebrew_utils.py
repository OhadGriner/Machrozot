from dataclasses import dataclass


@dataclass(frozen=True)
class Cell:
    row: int
    col: int


def word_from_cells(grid: list[list[str]], cells: list[Cell]) -> str:
    """Derive a word string from an ordered list of grid cell positions."""
    return "".join(grid[cell.row][cell.col] for cell in cells)


_FINAL_TO_REGULAR = {"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}


def normalize_word(word: str) -> str:
    """Map final-letter forms to their regular form, so a word matches regardless
    of which form appears in the grid vs. a word list. Must stay in sync with
    frontend/src/utils/hebrewUtils.ts's normalizeWord."""
    return "".join(_FINAL_TO_REGULAR.get(ch, ch) for ch in word)
