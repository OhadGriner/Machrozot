from app.services.grid_generator import COLS, ROWS
from app.services.word_solver import solve_grid


def _filler_grid(word: str) -> list[list[str]]:
    """8x6 grid filled with 'ק' (rarely forms real words when repeated), with
    `word` placed along row 0 starting at col 0 so it's trivially king-adjacent."""
    grid = [["ק" for _ in range(COLS)] for _ in range(ROWS)]
    for i, letter in enumerate(word):
        grid[0][i] = letter
    return grid


def test_finds_a_real_word_placed_on_the_grid():
    words = solve_grid(_filler_grid("שלום"), exclude_words=set())
    assert "שלום" in words


def test_excludes_words_the_puzzle_already_uses():
    words = solve_grid(_filler_grid("שלום"), exclude_words={"שלום"})
    assert "שלום" not in words


def test_respects_minimum_length_of_four():
    words = solve_grid(_filler_grid("של"), exclude_words=set())
    assert all(len(w) >= 4 for w in words)


def test_only_finds_king_adjacent_paths():
    # Split "שלום" across two non-adjacent rows (row 0 and row 2) — it should
    # not be findable, since the solver only walks king-adjacent cells.
    grid = [["ק" for _ in range(COLS)] for _ in range(ROWS)]
    grid[0][0], grid[0][1] = "ש", "ל"
    grid[2][0], grid[2][1] = "ו", "ם"
    words = solve_grid(grid, exclude_words=set())
    assert "שלום" not in words


def test_dedupes_results():
    words = solve_grid(_filler_grid("שלום"), exclude_words=set())
    assert len(words) == len(set(words))
