import random
import time

import pytest

from app.services.grid_generator import (
    COLS,
    ROWS,
    GridGenerationError,
    _find_traces,
    _has_ambiguous_trace,
    generate_grid,
    touches_opposite_edges,
)
from app.services.hebrew_utils import Cell, word_from_cells

ALPHABET = list("אבגדהוזחטיכלמנסעפצקרשת")  # 22 letters, no nikud/final forms


def make_word(length: int, offset: int = 0, stride: int = 1) -> str:
    """Build a word of `length` letters cycling the alphabet, starting `offset`
    positions into the cycle and stepping `stride` letters at a time. Distinct
    strides matter since the uniqueness rule fast-fails when one word (or its
    reverse) is a contiguous substring of another — with a shared stride of 1,
    consecutive alphabet runs inevitably embed each other."""
    return "".join(ALPHABET[(offset + i * stride) % len(ALPHABET)] for i in range(length))


def neighbors(row: int, col: int):
    for d_row in (-1, 0, 1):
        for d_col in (-1, 0, 1):
            if d_row == 0 and d_col == 0:
                continue
            n_row, n_col = row + d_row, col + d_col
            if 0 <= n_row < ROWS and 0 <= n_col < COLS:
                yield n_row, n_col


def assert_valid_layout(
    grid: list[list[str]],
    mega_machrozet: str,
    mega_machrozet_cells: list[Cell],
    words: list[str],
    word_cells: list[list[Cell]],
) -> None:
    # grid shape
    assert len(grid) == ROWS
    assert all(len(row) == COLS for row in grid)

    # full, non-overlapping coverage
    all_paths = [mega_machrozet_cells] + list(word_cells)
    all_coords = [(cell.row, cell.col) for path in all_paths for cell in path]
    assert len(all_coords) == ROWS * COLS
    assert len(set(all_coords)) == ROWS * COLS
    assert set(all_coords) == {(row, col) for row in range(ROWS) for col in range(COLS)}

    # each path is king-adjacent and self-avoiding
    for path in all_paths:
        coords = [(cell.row, cell.col) for cell in path]
        assert len(set(coords)) == len(coords)
        for (row1, col1), (row2, col2) in zip(coords, coords[1:]):
            assert abs(row1 - row2) <= 1 and abs(col1 - col2) <= 1

    # letters round-trip
    assert word_from_cells(grid, mega_machrozet_cells) == mega_machrozet
    for word, cells in zip(words, word_cells):
        assert word_from_cells(grid, cells) == word

    # mega_machrozet touches opposite edges
    assert touches_opposite_edges(mega_machrozet_cells[0], mega_machrozet_cells[-1])

    # rule 7: no two diagonal moves (in any path, including the same one
    # curling back on itself) form a crossing "X" within the same 2x2 block
    direction_of_block: dict[tuple[int, int], str] = {}
    for path in all_paths:
        coords = [(cell.row, cell.col) for cell in path]
        for (row1, col1), (row2, col2) in zip(coords, coords[1:]):
            if abs(row1 - row2) != 1 or abs(col1 - col2) != 1:
                continue  # not a diagonal step
            block = (min(row1, row2), min(col1, col2))
            direction = "main" if (row1 < row2) == (col1 < col2) else "anti"
            existing = direction_of_block.get(block)
            assert existing is None or existing == direction, (
                f"crossing diagonal moves in block {block}"
            )
            direction_of_block[block] = direction

    # rule 6: no cell may have two *selectable* neighbors holding the same
    # letter unless one of them is that cell's own fixed next step —
    # otherwise a solver who has correctly traced up to this cell can't tell
    # which neighbor is the real next letter of the word. Any *earlier* cell
    # in the same path (not just the immediate predecessor) is exempt even if
    # it happens to share the successor's letter — it's already used up in
    # the stroke and isn't a selectable candidate at this point, so it can't
    # actually confuse anyone (e.g. a word's own non-consecutive repeated
    # letter curling back near an earlier part of itself is allowed).
    successor_of_cell: dict[tuple[int, int], tuple[int, int]] = {}
    path_position_of_cell: dict[tuple[int, int], tuple[int, int]] = {}
    for path_id, path in enumerate(all_paths):
        coords = [(cell.row, cell.col) for cell in path]
        for index, coord in enumerate(coords):
            path_position_of_cell[coord] = (path_id, index)
        for coord_a, coord_b in zip(coords, coords[1:]):
            successor_of_cell[coord_a] = coord_b

    for row, col in all_coords:
        successor = successor_of_cell.get((row, col))
        if successor is None:
            continue  # last cell of its path — no "next letter" to be ambiguous about
        expected_letter = grid[successor[0]][successor[1]]
        this_path_id, this_index = path_position_of_cell[(row, col)]
        for n_row, n_col in neighbors(row, col):
            if (n_row, n_col) == successor:
                continue
            other_path_id, other_index = path_position_of_cell[(n_row, n_col)]
            already_used = other_path_id == this_path_id and other_index <= this_index
            if already_used:
                continue
            assert grid[n_row][n_col] != expected_letter, (
                f"cell {(row, col)} has an ambiguous second neighbor "
                f"{(n_row, n_col)} matching its real next step {successor}"
            )


def test_fast_fail_on_total_length_mismatch():
    with pytest.raises(GridGenerationError):
        generate_grid("תפוח", ["אגס"])


def test_fast_fail_on_embedded_word():
    # "וחיל" is a contiguous substring of the mega machrozet's letters below —
    # wherever the longer one is placed, the shorter is traceable along its
    # own path, so the uniqueness rule could never be satisfied. Must fail
    # fast instead of retrying forever.
    words = [make_word(length=n, offset=(i + 1) * 5, stride=i + 2) for i, n in enumerate([5, 6, 6, 5, 6, 8])]
    with pytest.raises(GridGenerationError):
        generate_grid("אבגדהוזח", ["בגדה", *words])


def test_fast_fail_on_reversed_embedded_word():
    words = [make_word(length=n, offset=(i + 1) * 5, stride=i + 2) for i, n in enumerate([5, 6, 6, 5, 6, 8])]
    with pytest.raises(GridGenerationError):
        generate_grid("אבגדהוזח", ["הדגב", *words])


def test_fast_fail_on_mega_machrozet_too_short():
    words = [make_word(length=9, offset=i * 9) for i in range(5)]  # 5*9 = 45
    with pytest.raises(GridGenerationError):
        generate_grid("אבג", words)  # mega_machrozet len 3 < 6


def test_touches_opposite_edges():
    assert touches_opposite_edges(Cell(row=0, col=2), Cell(row=7, col=4)) is True  # rows 0 & 7
    assert touches_opposite_edges(Cell(row=3, col=0), Cell(row=5, col=5)) is True  # cols 0 & 5
    assert touches_opposite_edges(Cell(row=2, col=2), Cell(row=3, col=3)) is False  # neither
    assert touches_opposite_edges(Cell(row=0, col=1), Cell(row=1, col=1)) is False  # neither


@pytest.mark.slow
def test_single_theme_word_full_generation():
    # A single 38-letter word must fill nearly the entire board itself —
    # close to a Hamiltonian path, which the current true-backtracking
    # engine can take well over a minute to find.
    mega_machrozet = make_word(length=10)
    words = [make_word(length=38, offset=5, stride=3)]
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)


@pytest.mark.slow
def test_word_cells_preserve_input_order():
    # Real, known-placeable content (backend/scripts/seed_yafe_einaim.py) —
    # this test only cares about order preservation, so there's no need for
    # synthetic data that risks accidentally creating a hard-to-place shape.
    # (It's still marked slow: this real content itself can take up to a
    # minute with the current backtracking algorithm.)
    mega_machrozet = "דודבנישי"
    words = ["יהונתנ", "אמנונ", "תהילימ", "אבשלומ", "בתשבע", "גוליית", "ביתלחמ"]
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    assert len(word_cells) == len(words)
    for word, cells in zip(words, word_cells):
        assert word_from_cells(grid, cells) == word


@pytest.mark.slow
def test_full_roundtrip_typical_puzzle():
    # generate_grid uses the unseeded global `random` module, so even this
    # "known reliable" shape has real run-to-run variance — usually fast,
    # but occasionally slow with the current true-backtracking algorithm.
    mega_machrozet = make_word(length=8)
    lengths = [4, 5, 6, 6, 5, 6, 8]  # sums to 40; + mega_machrozet(8) = 48
    words = [make_word(length=n, offset=(i + 1) * 5, stride=i + 2) for i, n in enumerate(lengths)]
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)


@pytest.mark.slow
def test_word_with_internal_doubled_letter_is_allowed():
    # Same even-sized word-list shape as test_full_roundtrip_typical_puzzle
    # (known reliable — see that test and the real seeded-puzzle data) with
    # just one word modified to start with a doubled letter. A lopsided size
    # split (one huge word against tiny ones) is a much harder, unrelated
    # bin-packing problem — not what this test is meant to exercise.
    mega_machrozet = make_word(length=8)
    doubled_word = "אאגט"  # length 4, starts with two identical letters
    other_lengths = [5, 6, 6, 5, 6, 8]  # sums to 36; + doubled_word(4) = 40; + mega_machrozet(8) = 48
    words = [doubled_word] + [
        make_word(length=n, offset=(i + 1) * 5, stride=i + 2) for i, n in enumerate(other_lengths)
    ]
    assert len(mega_machrozet) + sum(len(word) for word in words) == 48
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)


@pytest.mark.slow
def test_cross_word_letter_collisions_never_appear_in_output():
    # Same even-sized word-list shape as test_full_roundtrip_typical_puzzle
    # (known reliable), but with tighter offset spacing so consecutive words
    # deliberately share several letters — enough to make boundary collisions
    # plausible without the extreme wall-to-wall overlap that (as discovered
    # while testing) makes placement disproportionately hard regardless of
    # letter content. Runs several seeded attempts to confirm the
    # rejection-and-retry logic actually filters collisions out reliably.
    mega_machrozet = make_word(length=8)
    lengths = [4, 5, 6, 6, 5, 6, 8]  # sums to 40; + mega_machrozet(8) = 48
    words = [make_word(length=n, offset=(i + 1) * 5, stride=i + 2) for i, n in enumerate(lengths)]
    assert len(mega_machrozet) + sum(len(word) for word in words) == 48

    for seed in range(2):
        random.seed(seed)
        grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
        assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)


SMALL_ALPHABET = ALPHABET[:10]  # only 10 distinct letters, to force heavy reuse


def make_word_from_small_alphabet(length: int, offset: int = 0, stride: int = 1) -> str:
    """Like make_word, but cycles only the first 10 letters — used to stress
    *cross-word* letter reuse. Word lengths here must stay <= 10 so no single
    word repeats a letter internally (that's a different, much harder
    self-avoidance problem, tested separately). Strides must be coprime with
    10 (1/3/7/9) to preserve that no-internal-repeat property."""
    return "".join(SMALL_ALPHABET[(offset + i * stride) % len(SMALL_ALPHABET)] for i in range(length))


@pytest.mark.slow
def test_many_repeated_letters_terminates_within_budget():
    # Same even-sized word-list shape as test_full_roundtrip_typical_puzzle
    # (known reliable), but drawing only from a 10-letter alphabet instead of
    # the full 22 — heavily repetitive and stressful for rule 6's cross-word
    # collision avoidance, without any single word's own internal shape being
    # unrealistically constrained (each word length stays within the 10-letter
    # cycle, so no word repeats a letter against itself).
    mega_machrozet = make_word_from_small_alphabet(length=8, offset=7, stride=9)
    # (offset, stride) pairs verified conflict-free: with only 10 letters, most
    # configurations embed one word inside another (or its reverse), which the
    # uniqueness rule now fast-fails as unplaceable.
    shapes = [(4, 2, 3), (5, 0, 7), (6, 6, 7), (6, 8, 9), (5, 5, 1), (6, 9, 7), (8, 8, 7)]
    words = [make_word_from_small_alphabet(length=n, offset=o, stride=s) for n, o, s in shapes]
    assert len(mega_machrozet) + sum(len(word) for word in words) == 48

    start = time.monotonic()
    grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
    assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)
    elapsed = time.monotonic() - start
    # Generation speed isn't a priority — this bound only exists to catch a
    # genuine infinite loop, not to keep placement fast.
    assert elapsed < 180


@pytest.mark.slow
def test_no_cell_has_two_neighbors_matching_its_real_next_letter():
    # Rule 6 regression: e.g. for a word "abcd", once a solver has correctly
    # traced "abc", the cell holding "c" must not have a second neighbor also
    # holding "d" — that would be indistinguishable from the real next step.
    # Same heavily-repetitive small-alphabet shape as
    # test_many_repeated_letters_terminates_within_budget (known to stress
    # cross-word letter reuse the hardest), run across several seeds so a
    # lucky single layout can't mask the rejection-and-retry logic failing.
    mega_machrozet = make_word_from_small_alphabet(length=8, offset=7, stride=9)
    # (offset, stride) pairs verified conflict-free: with only 10 letters, most
    # configurations embed one word inside another (or its reverse), which the
    # uniqueness rule now fast-fails as unplaceable.
    shapes = [(4, 2, 3), (5, 0, 7), (6, 6, 7), (6, 8, 9), (5, 5, 1), (6, 9, 7), (8, 8, 7)]
    words = [make_word_from_small_alphabet(length=n, offset=o, stride=s) for n, o, s in shapes]
    assert len(mega_machrozet) + sum(len(word) for word in words) == 48

    for seed in range(2):
        random.seed(seed)
        grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
        assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)


@pytest.mark.slow
def test_performance_with_real_yafe_einaim_words():
    # Real puzzle content (backend/scripts/seed_yafe_einaim.py), not synthetic
    # stress data — measures how long generation actually takes on a realistic
    # word list, across several trials.
    mega_machrozet = "דודבנישי"
    words = ["יהונתנ", "אמנונ", "תהילימ", "אבשלומ", "בתשבע", "גוליית", "ביתלחמ"]
    assert len(mega_machrozet) + sum(len(word) for word in words) == 48

    # The mega_machrozet grows with fully uniform-random placement (traded away
    # Warnsdorff's speed for shape variety) and word placement now does real
    # backtracking against a reachability check — either can legitimately
    # take up to a couple of minutes on this word list, so a single trial is
    # enough to smoke-test it; the old 20-trial statistical timing sweep
    # would make routine test runs impractically slow.
    trial_count = 1
    elapsed_times = []
    for trial in range(trial_count):
        random.seed(trial)
        start = time.monotonic()
        grid, mega_machrozet_cells, word_cells = generate_grid(mega_machrozet, words)
        elapsed_times.append(time.monotonic() - start)
        assert_valid_layout(grid, mega_machrozet, mega_machrozet_cells, words, word_cells)

    print(f"\n{trial_count} trials — min: {min(elapsed_times):.4f}s, "
          f"max: {max(elapsed_times):.4f}s, avg: {sum(elapsed_times) / trial_count:.4f}s, "
          f"total: {sum(elapsed_times):.4f}s")


def _filler_grid() -> list[list[str]]:
    """8x6 grid of distinct-ish filler letters that can't accidentally spell
    the planted test words (which use letters absent from the filler set)."""
    filler = "קרשתסעפצ"
    return [[filler[(row * COLS + col) % len(filler)] for col in range(COLS)] for row in range(ROWS)]


def test_find_traces_finds_a_single_planted_path():
    grid = _filler_grid()
    route = [(0, 0), (0, 1), (1, 2)]
    for (row, col), letter in zip(route, "אבג"):
        grid[row][col] = letter

    traces = _find_traces(grid, "אבג", limit=3)
    assert traces == [route]


def test_has_ambiguous_trace_detects_a_duplicate_elsewhere():
    grid = _filler_grid()
    route = [(0, 0), (0, 1), (1, 2)]
    for (row, col), letter in zip(route, "אבג"):
        grid[row][col] = letter
    # The same word traceable in a far corner of the board.
    for (row, col), letter in zip([(7, 5), (7, 4), (6, 3)], "אבג"):
        grid[row][col] = letter

    assert _has_ambiguous_trace(grid, "אבג", route)


def test_has_ambiguous_trace_detects_alternate_start_into_shared_tail():
    # The user-reported shape: the word's tail is shared, but a decoy first
    # letter lets the trace start from a second location.
    grid = _filler_grid()
    route = [(2, 2), (2, 3), (2, 4)]
    for (row, col), letter in zip(route, "אבג"):
        grid[row][col] = letter
    grid[3][2] = "א"  # second א also adjacent to the ב at (2,3)

    assert _has_ambiguous_trace(grid, "אבג", route)


def test_palindrome_reverse_of_own_path_is_not_ambiguous():
    grid = _filler_grid()
    route = [(0, 0), (0, 1), (0, 2)]
    for (row, col), letter in zip(route, "אבא"):
        grid[row][col] = letter

    assert not _has_ambiguous_trace(grid, "אבא", route)


def test_unique_path_is_not_ambiguous():
    grid = _filler_grid()
    route = [(4, 0), (5, 1), (4, 2), (3, 3)]
    for (row, col), letter in zip(route, "אבגד"):
        grid[row][col] = letter

    assert not _has_ambiguous_trace(grid, "אבגד", route)
