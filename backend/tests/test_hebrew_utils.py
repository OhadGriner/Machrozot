import pytest

from app.services.hebrew_utils import Cell, word_from_cells


@pytest.fixture
def sample_grid():
    return [
        ["ש", "ל", "ו"],
        ["מ", "א", "ה"],
    ]


def test_word_from_cells(sample_grid):
    cells = [Cell(row=0, col=0), Cell(row=0, col=1), Cell(row=1, col=0)]
    assert word_from_cells(sample_grid, cells) == "שלמ"


def test_word_from_cells_single(sample_grid):
    assert word_from_cells(sample_grid, [Cell(row=0, col=0)]) == "ש"


def test_word_from_cells_full_row(sample_grid):
    cells = [Cell(row=1, col=0), Cell(row=1, col=1), Cell(row=1, col=2)]
    assert word_from_cells(sample_grid, cells) == "מאה"
