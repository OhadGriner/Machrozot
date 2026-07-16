import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.services.grid_generator import COLS, NEIGHBORS, ROWS
from app.services.hebrew_utils import normalize_word

_WORDLIST_PATH = Path(__file__).resolve().parent.parent / "data" / "hebrew_words.txt"
_MIN_WORD_LENGTH = 4
_MAX_WORD_LENGTH = 12
_NIQQUD_PATTERN = re.compile(r"[ְ-ׇ]")


@lru_cache(maxsize=1)
def _load_wordlist() -> list[str]:
    seen_normalized: set[str] = set()
    words: list[str] = []
    with _WORDLIST_PATH.open(encoding="utf-8") as f:
        for raw_line in f:
            word = _NIQQUD_PATTERN.sub("", raw_line.strip())
            if not (_MIN_WORD_LENGTH <= len(word) <= _MAX_WORD_LENGTH):
                continue
            normalized = normalize_word(word)
            if normalized in seen_normalized:
                continue
            seen_normalized.add(normalized)
            words.append(word)
    return words


@dataclass
class _TrieNode:
    children: dict[str, "_TrieNode"] = field(default_factory=dict)
    word: str | None = None


def _build_trie(words: list[str], available_letters: set[str]) -> _TrieNode:
    root = _TrieNode()
    for word in words:
        normalized = normalize_word(word)
        if not set(normalized) <= available_letters:
            continue
        node = root
        for ch in normalized:
            node = node.children.setdefault(ch, _TrieNode())
        node.word = word
    return root


def solve_grid(grid: list[list[str]], exclude_words: set[str]) -> list[str]:
    """Find every dictionary word (length >= 4) traceable on the grid via
    king-adjacent, non-repeating cells. Used to gate hint-earning to real
    words instead of any arbitrary >=4-letter selection."""
    normalized_grid = [[normalize_word(cell) for cell in row] for row in grid]
    available_letters = {ch for row in normalized_grid for ch in row}
    trie = _build_trie(_load_wordlist(), available_letters)

    normalized_exclude = {normalize_word(w) for w in exclude_words}
    results: set[str] = set()

    def dfs(row: int, col: int, node: _TrieNode, visited: int) -> None:
        if node.word is not None and normalize_word(node.word) not in normalized_exclude:
            results.add(node.word)
        for nrow, ncol in NEIGHBORS[(row, col)]:
            bit = 1 << (nrow * COLS + ncol)
            if visited & bit:
                continue
            letter = normalized_grid[nrow][ncol]
            child = node.children.get(letter)
            if child is None:
                continue
            dfs(nrow, ncol, child, visited | bit)

    for row in range(ROWS):
        for col in range(COLS):
            letter = normalized_grid[row][col]
            child = trie.children.get(letter)
            if child is None:
                continue
            dfs(row, col, child, 1 << (row * COLS + col))

    return sorted(results)
