import pytest

from app.services.hebrew_utils import word_from_cells


@pytest.fixture
def sample_grid():
    return [
        ["ש", "ל", "ו"],
        ["מ", "א", "ה"],
    ]


def test_word_from_cells(sample_grid):
    cells = [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 0}]
    assert word_from_cells(sample_grid, cells) == "שלמ"


def test_word_from_cells_single(sample_grid):
    assert word_from_cells(sample_grid, [{"row": 0, "col": 0}]) == "ש"


def test_word_from_cells_full_row(sample_grid):
    cells = [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}]
    assert word_from_cells(sample_grid, cells) == "מאה"
