def word_from_cells(grid: list[list[str]], cells: list[dict]) -> str:
    """Derive a word string from an ordered list of {row, col} cell positions."""
    return "".join(grid[c["row"]][c["col"]] for c in cells)
