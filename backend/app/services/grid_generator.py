import random
from collections.abc import Callable
from dataclasses import dataclass, field

from app.services.hebrew_utils import Cell, normalize_word

ROWS, COLS = 8, 6
TOTAL_CELLS = ROWS * COLS
MIN_MEGA_MACHROZET_LENGTH = min(ROWS, COLS)  # shortest possible span between opposite edges
LONG_WORD_LENGTH = 8  # only bias growth for paths longer than this

ALL_COORDS = [(row, col) for row in range(ROWS) for col in range(COLS)]

Coord = tuple[int, int]


@dataclass
class GenerationState:
    grid: list[list[str]]
    mega_machrozet_route: list[Coord]
    word_routes: list[list[Coord]] = field(default_factory=list)


class GridGenerationError(Exception):
    """Raised when no valid grid layout could be found for the given words."""


def touches_opposite_edges(cell_a: Cell, cell_b: Cell) -> bool:
    spans_rows = (cell_a.row == 0 and cell_b.row == ROWS - 1) or (
        cell_a.row == ROWS - 1 and cell_b.row == 0
    )
    spans_cols = (cell_a.col == 0 and cell_b.col == COLS - 1) or (
        cell_a.col == COLS - 1 and cell_b.col == 0
    )
    return spans_rows or spans_cols


def _king_neighbors() -> dict[Coord, list[Coord]]:
    neighbor_map = {}
    for row, col in ALL_COORDS:
        candidates = []
        for d_row in (-1, 0, 1):
            for d_col in (-1, 0, 1):
                if d_row == 0 and d_col == 0:
                    continue
                n_row, n_col = row + d_row, col + d_col
                if 0 <= n_row < ROWS and 0 <= n_col < COLS:
                    candidates.append((n_row, n_col))
        neighbor_map[(row, col)] = candidates
    return neighbor_map


NEIGHBORS = _king_neighbors()


def _has_committed_neighbor_with_letter(
    coord: Coord,
    letter: str,
    exclude: Coord,
    grid: list[list[str]],
    ignore: frozenset[Coord] = frozenset(),
) -> bool:
    """Does `coord` already have an already-committed neighbor (other than
    `exclude`) holding `letter`? `ignore`, if given, is this same route's own
    earlier steps — needed since `_place_route` writes to `grid` eagerly as
    it goes, so the route's own in-progress cells are already visible in
    `grid` and must be told apart from genuinely foreign, already-committed
    decoys."""
    for neighbor in NEIGHBORS[coord]:
        if neighbor == exclude or neighbor in ignore:
            continue
        n_row, n_col = neighbor
        if grid[n_row][n_col] == letter:
            return True
    return False


def _creates_fork_ambiguity(
    coord: Coord,
    letter: str,
    grid: list[list[str]],
    committed_successor: dict[Coord, Coord],
    in_progress_successor: dict[Coord, Coord],
) -> bool:
    """Would placing `letter` at `coord` become a decoy for some already-fixed
    step elsewhere on the board? If a neighbor `A` of `coord` already has a
    fixed next cell `B` (its forced successor within A's own path, B != coord)
    that holds `letter` too, a solver standing at A would see two neighbors
    with the same letter and no way to tell which is the real next step."""
    for neighbor in NEIGHBORS[coord]:
        succ = committed_successor.get(neighbor)
        if succ is None:
            succ = in_progress_successor.get(neighbor)
        if succ is None or succ == coord:
            continue
        succ_row, succ_col = succ
        if grid[succ_row][succ_col] == letter:
            return True
    return False


def _diagonal_block_and_direction(coord_a: Coord, coord_b: Coord) -> tuple[Coord, str] | None:
    """If coord_a -> coord_b is a diagonal step, return the 2x2 block it sits
    in (identified by its top-left corner) and which way it leans ("main" is
    top-left-to-bottom-right \\, "anti" is top-right-to-bottom-left /).
    Returns None for a non-diagonal (horizontal/vertical) step."""
    row_a, col_a = coord_a
    row_b, col_b = coord_b
    if abs(row_a - row_b) != 1 or abs(col_a - col_b) != 1:
        return None
    block = (min(row_a, row_b), min(col_a, col_b))
    direction = "main" if (row_a < row_b) == (col_a < col_b) else "anti"
    return block, direction


def _creates_diagonal_crossing(
    coord_a: Coord,
    coord_b: Coord,
    committed_diagonals: dict[Coord, str],
    in_progress_diagonals: dict[Coord, str],
) -> bool:
    """Would the step coord_a -> coord_b cross an already-used diagonal step
    in the same 2x2 block (the classic 'X' — two diagonal lines crossing
    without sharing a cell)? Applies across all words and the mega machrozet, and
    within a single path curling back near itself."""
    result = _diagonal_block_and_direction(coord_a, coord_b)
    if result is None:
        return False
    block, direction = result
    existing = committed_diagonals.get(block) or in_progress_diagonals.get(block)
    return existing is not None and existing != direction


def _onward_option_count(coord: Coord, grid: list[list[str]]) -> int:
    """How many empty neighbors does `coord` itself lead to? Used by
    Warnsdorff's rule to steer growth away from painting into a corner."""
    return sum(1 for neighbor in NEIGHBORS[coord] if not grid[neighbor[0]][neighbor[1]])


def _commit_path(
    coords: list[Coord],
    text: str,
    grid: list[list[str]],
    committed_diagonals: dict[Coord, str],
    committed_successor: dict[Coord, Coord],
) -> None:
    for letter, (row, col) in zip(text, coords):
        grid[row][col] = letter
    for coord_a, coord_b in zip(coords, coords[1:]):
        committed_successor[coord_a] = coord_b
        diagonal = _diagonal_block_and_direction(coord_a, coord_b)
        if diagonal is not None:
            block, direction = diagonal
            committed_diagonals[block] = direction


def _connected_components(cells: set[Coord]) -> list[set[Coord]]:
    remaining = set(cells)
    components = []
    while remaining:
        start = next(iter(remaining))
        component = {start}
        frontier = [start]
        remaining.discard(start)
        while frontier:
            current = frontier.pop()
            for neighbor in NEIGHBORS[current]:
                if neighbor in remaining:
                    remaining.discard(neighbor)
                    component.add(neighbor)
                    frontier.append(neighbor)
        components.append(component)
    return components


def _can_partition_into_sizes(component_sizes: list[int], lengths: list[int]) -> bool:
    """Can `lengths` be grouped so each group's sum exactly matches one component size?"""

    def solve(index: int, remaining_sizes: list[int]) -> bool:
        if index == len(lengths):
            return all(size == 0 for size in remaining_sizes)
        length = lengths[index]
        for slot, size in enumerate(remaining_sizes):
            if size >= length:
                next_sizes = list(remaining_sizes)
                next_sizes[slot] -= length
                if solve(index + 1, next_sizes):
                    return True
        return False

    return solve(0, component_sizes)


def _remaining_words_still_fit(free_cells: set[Coord], remaining_lengths: list[int]) -> bool:
    if not remaining_lengths:
        return len(free_cells) == 0
    components = _connected_components(free_cells)
    if len(components) == 1:
        return True
    component_sizes = [len(component) for component in components]
    return _can_partition_into_sizes(component_sizes, remaining_lengths)


def _cells_from_coords(coords: list[Coord]) -> list[Cell]:
    return [Cell(row=row, col=col) for row, col in coords]


def _mega_machrozet_start_candidates(mega_machrozet_length: int, rng: random.Random) -> list[Coord]:
    """Ordered list of candidate starting cells for the mega machrozet — the
    order they'll be tried in `_place_mega_machrozet`. A mega machrozet of 8+
    letters needs every one of its cells to span row 0 -> row 7 (no slack),
    so the top/bottom edge is tried first, shuffled; the left/right edge —
    which only needs 5 of the available cells, so it's more forgiving — is
    shuffled separately and tried after. A mega machrozet shorter than 8
    letters can't reach both row edges at all, so only the left/right edge is
    offered."""
    top_bottom = [(0, col) for col in range(COLS)] + [(ROWS - 1, col) for col in range(COLS)]
    left_right = [(row, 0) for row in range(ROWS)] + [(row, COLS - 1) for row in range(ROWS)]
    rng.shuffle(top_bottom)
    rng.shuffle(left_right)
    if mega_machrozet_length >= LONG_WORD_LENGTH:
        return top_bottom + left_right
    return left_right


def _next_valid_locations(
    location: Coord, grid: list[list[str]], use_warnsdorff: bool = False
) -> list[Coord]:
    """All cells one king-move away from `location` that are still empty, in
    randomized order. When `use_warnsdorff` is True, additionally biases
    toward cells with fewer of their own onward options first (Warnsdorff's
    rule) — dead-ends far less often this way, since "tight" cells get
    filled before they're painted shut; ties are still broken randomly,
    since the list is shuffled before the (stable) sort."""
    locations = [
        neighbor
        for neighbor in NEIGHBORS[location]
        if not grid[neighbor[0]][neighbor[1]]
    ]
    random.shuffle(locations)
    if use_warnsdorff:
        locations.sort(key=lambda coord: _onward_option_count(coord, grid))
    return locations


def _place_route(
    state: GenerationState,
    route: list[Coord],
    text: str,
    locations: list[Coord],
    committed_successor: dict[Coord, Coord],
    committed_diagonals: dict[Coord, str],
    use_warnsdorff: bool = False,
    is_valid_finish: Callable[[list[Coord]], bool] | None = None,
) -> bool:
    """Recursively try each coordinate in `locations`, in order, as the next
    cell of `route` until it holds len(text) cells. Shared engine for both
    the mega machrozet and each word. `is_valid_finish`, if given, is an extra
    check run once the route reaches full length — e.g. the mega machrozet must
    also touch opposite edges, a word must also leave the rest of the board
    still fittable by the words not yet placed — and rejecting it here
    backtracks into trying a *different* placement for this same route,
    rather than only discovering the problem after the fact.

    Skips any candidate that would create a same-letter "fork" — two
    neighbors of one cell holding the same letter, so a solver mid-drag
    can't tell which is the real next step — against anything already
    committed (an earlier, fully-placed route) or fixed earlier in this same
    route, or that would cross an already-used diagonal step. Undoes its own
    placement and tries the next candidate on failure (backtracking)."""
    letter = text[0]
    previous = route[-1] if route else None
    route_so_far = frozenset(route)

    in_progress_successor = dict(zip(route, route[1:]))
    in_progress_diagonals: dict[Coord, str] = {}
    for coord_a, coord_b in zip(route, route[1:]):
        diagonal = _diagonal_block_and_direction(coord_a, coord_b)
        if diagonal is not None:
            block, direction = diagonal
            in_progress_diagonals[block] = direction

    for location in locations:
        if previous is not None and _has_committed_neighbor_with_letter(
            previous, letter, location, state.grid, ignore=route_so_far
        ):
            continue
        if _creates_fork_ambiguity(
            location, letter, state.grid, committed_successor, in_progress_successor
        ):
            continue
        if previous is not None and _creates_diagonal_crossing(
            previous, location, committed_diagonals, in_progress_diagonals
        ):
            continue

        state.grid[location[0]][location[1]] = letter
        route.append(location)

        if len(text) == 1:
            success = is_valid_finish is None or is_valid_finish(route)
        else:
            next_locations = _next_valid_locations(location, state.grid, use_warnsdorff)
            success = _place_route(
                state, route, text[1:], next_locations,
                committed_successor, committed_diagonals, use_warnsdorff, is_valid_finish,
            )

        if success:
            return True

        route.pop()
        state.grid[location[0]][location[1]] = ""

    return False


def _place_mega_machrozet(
    state: GenerationState,
    mega_machrozet: str,
    locations: list[Coord],
    committed_successor: dict[Coord, Coord] | None = None,
    committed_diagonals: dict[Coord, str] | None = None,
) -> bool:
    return _place_route(
        state, state.mega_machrozet_route, mega_machrozet, locations,
        committed_successor if committed_successor is not None else {},
        committed_diagonals if committed_diagonals is not None else {},
        use_warnsdorff=False,
        is_valid_finish=lambda route: touches_opposite_edges(Cell(*route[0]), Cell(*route[-1])),
    )


def _place_word(
    state: GenerationState,
    word: str,
    route: list[Coord],
    locations: list[Coord],
    committed_successor: dict[Coord, Coord],
    committed_diagonals: dict[Coord, str],
    remaining_lengths: list[int],
) -> bool:
    def fits_remaining_words(_route: list[Coord]) -> bool:
        free_cells = {coord for coord in ALL_COORDS if not state.grid[coord[0]][coord[1]]}
        return _remaining_words_still_fit(free_cells, remaining_lengths)

    return _place_route(
        state, route, word, locations,
        committed_successor, committed_diagonals,
        use_warnsdorff=True,
        is_valid_finish=fits_remaining_words,
    )


def _find_traces(grid: list[list[str]], word: str, limit: int) -> list[list[Coord]]:
    """Every way `word` can be traced on the finished grid (any starting cell,
    king-moves, no cell revisited) — the same search a player's finger does.
    Stops once `limit` traces are found."""
    target = normalize_word(word)
    normalized_grid = [[normalize_word(letter) for letter in row] for row in grid]
    traces: list[list[Coord]] = []

    def dfs(coord: Coord, index: int, path: list[Coord], visited: set[Coord]) -> None:
        if len(traces) >= limit:
            return
        if index == len(target):
            traces.append(path.copy())
            return
        for neighbor in NEIGHBORS[coord]:
            if neighbor in visited:
                continue
            if normalized_grid[neighbor[0]][neighbor[1]] != target[index]:
                continue
            visited.add(neighbor)
            path.append(neighbor)
            dfs(neighbor, index + 1, path, visited)
            path.pop()
            visited.remove(neighbor)

    for start in ALL_COORDS:
        if len(traces) >= limit:
            break
        if normalized_grid[start[0]][start[1]] != target[0]:
            continue
        dfs(start, 1, [start], {start})

    return traces


def _has_ambiguous_trace(grid: list[list[str]], word: str, committed_route: list[Coord]) -> bool:
    """True if `word` can be traced anywhere on the board other than its own
    committed path. The committed path's exact reverse is tolerated — a
    palindrome is always traceable backwards along its own cells (same fill,
    reversed order), and no regeneration could ever remove that."""
    allowed = {tuple(committed_route), tuple(reversed(committed_route))}
    # limit=3 suffices: committed + (possibly) its reverse + one extra proves ambiguity.
    return any(tuple(trace) not in allowed for trace in _find_traces(grid, word, limit=3))


def validate_word_set(mega_machrozet: str, words: list[str]) -> None:
    """Every deterministic reason a word set can never be placed, checked up
    front — callers (e.g. the admin create endpoint) run this synchronously so
    the author gets an immediate 422 instead of a doomed background job."""
    total_letters = len(mega_machrozet) + sum(len(word) for word in words)
    if total_letters != TOTAL_CELLS:
        raise GridGenerationError(
            f"mega_machrozet+words length {total_letters} != {TOTAL_CELLS}"
        )

    # An embedded word can never satisfy the uniqueness rule: if word A (or
    # its reverse) is a contiguous substring of word B, then wherever B is
    # placed, A is traceable along that stretch of B's own path — every
    # candidate layout would be rejected and the retry loop would spin
    # forever. Fail fast with a clear message instead.
    normalized_entries = [normalize_word(w) for w in (mega_machrozet, *words)]
    for i, entry_a in enumerate(normalized_entries):
        for j, entry_b in enumerate(normalized_entries):
            if i == j:
                continue
            if entry_a in entry_b or entry_a[::-1] in entry_b:
                raise GridGenerationError(
                    f'המילה "{entry_a}" מוכלת בתוך "{entry_b}" — לא ניתן ליצור לוח שבו '
                    f"לכל מילה יש נתיב יחיד"
                )
    if len(mega_machrozet) < MIN_MEGA_MACHROZET_LENGTH:
        raise GridGenerationError(
            f"mega_machrozet length {len(mega_machrozet)} cannot span opposite edges of an "
            f"{ROWS}x{COLS} board (minimum is {MIN_MEGA_MACHROZET_LENGTH})"
        )


def generate_grid(
    mega_machrozet: str,
    words: list[str],
) -> tuple[list[list[str]], list[Cell], list[list[Cell]]]:
    """Place the mega machrozet + words into a legal 8x6 grid.

    Returns (grid, mega_machrozet_cells, word_cells).
    """
    validate_word_set(mega_machrozet, words)

    # Place longest words first — they're pickiest about available space.
    order = sorted(range(len(words)), key=lambda index: -len(words[index]))

    while True:
        state = GenerationState(
            grid=[["" for _ in range(COLS)] for _ in range(ROWS)],
            mega_machrozet_route=[],
            word_routes=[[] for _ in words],
        )
        committed_successor: dict[Coord, Coord] = {}
        committed_diagonals: dict[Coord, str] = {}

        mega_machrozet_start_candidates = _mega_machrozet_start_candidates(len(mega_machrozet), random)
        if not _place_mega_machrozet(
            state, mega_machrozet, mega_machrozet_start_candidates, committed_successor, committed_diagonals
        ):
            continue
        _commit_path(state.mega_machrozet_route, mega_machrozet, state.grid, committed_diagonals, committed_successor)

        placement_failed = False
        for position, word_index in enumerate(order):
            word = words[word_index]
            free_cells = [coord for coord in ALL_COORDS if not state.grid[coord[0]][coord[1]]]
            random.shuffle(free_cells)
            remaining_lengths = [len(words[other_index]) for other_index in order[position + 1:]]
            if not _place_word(
                state, word, state.word_routes[word_index], free_cells,
                committed_successor, committed_diagonals, remaining_lengths,
            ):
                placement_failed = True
                break
            _commit_path(
                state.word_routes[word_index], word, state.grid, committed_diagonals, committed_successor
            )

        if placement_failed:
            continue

        # Global uniqueness: every answer word must have exactly one trace on
        # the finished board. The step-level fork check above can't catch a
        # full alternate path starting somewhere else entirely — and since the
        # client validates by exact cell path, a player tracing such a
        # duplicate would spell the word correctly yet be rejected.
        all_routes = [(mega_machrozet, state.mega_machrozet_route)] + [
            (words[i], state.word_routes[i]) for i in range(len(words))
        ]
        if any(_has_ambiguous_trace(state.grid, word, route) for word, route in all_routes):
            continue

        mega_machrozet_cells = _cells_from_coords(state.mega_machrozet_route)
        word_cells = [_cells_from_coords(state.word_routes[i]) for i in range(len(words))]
        return state.grid, mega_machrozet_cells, word_cells

