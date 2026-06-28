"""
Quick script to seed today's puzzle via the API.
Usage: uv run --project backend python scripts/seed_puzzle.py
"""

import json
import urllib.request
from datetime import date

# A small test puzzle. Theme: פירות (fruits)
# Grid is 6 rows × 8 cols of Hebrew consonants (no nikud, no final forms)
puzzle = {
    "theme": "פירות",
    "grid": [
        ["ת", "פ", "ו", "ח", "כ", "ת", "ו", "מ"],
        ["א", "ג", "ס", "ל", "י", "מ", "ו", "נ"],
        ["ע", "נ", "ב", "א", "ב", "ט", "י", "ח"],
        ["מ", "נ", "ג", "ו", "ל", "ד", "ש", "ז"],
        ["ר", "ב", "נ", "א", "נ", "ה", "פ", "ר"],
        ["ס", "ק", "י", "ו", "י", "ב", "ל", "ה"],
    ],
    # spangram: תפוחכתום (orange-colored apple — spans rows 0-1)
    "spangram_cells": [
        {"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3},
        {"row": 0, "col": 4}, {"row": 0, "col": 5}, {"row": 0, "col": 6}, {"row": 0, "col": 7},
    ],
    "word_cells": [
        # תפוח (apple): row 0 cols 0-3
        [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}],
        # אגס (pear): row 1 cols 0-2
        [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}],
        # לימון (lemon): row 1 cols 3-7
        [{"row": 1, "col": 3}, {"row": 1, "col": 4}, {"row": 1, "col": 5}, {"row": 1, "col": 6}, {"row": 1, "col": 7}],
        # אבטיח (watermelon): row 2 cols 3-7
        [{"row": 2, "col": 3}, {"row": 2, "col": 4}, {"row": 2, "col": 5}, {"row": 2, "col": 6}, {"row": 2, "col": 7}],
    ],
    "scheduled_date": str(date.today()),
}

body = json.dumps(puzzle).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/puzzle",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))
