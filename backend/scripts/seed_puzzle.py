"""
Quick script to seed today's puzzle via the API.
Usage:
  python backend/scripts/seed_puzzle.py
  API_URL=https://your-app.railway.app python backend/scripts/seed_puzzle.py
"""

import json
import urllib.request
from datetime import date

# Test puzzle. Theme: פירות (fruits)
# Grid is 8 rows × 6 cols of Hebrew consonants (no nikud, no final forms)
#
#   ת פ ו ח כ ת
#   א ג ס מ נ ג
#   ו ל י מ ו נ
#   א ב ט י ח ע
#   נ ב א נ נ ה
#   מ נ ג ו ל ד
#   ש ז ר ב נ א
#   ס ק י ו י ב
#
# spangram: תפוחכת (col 0-5, row 0)
# words:
#   אגס  → (1,0),(1,1),(1,2)
#   לימונ → (2,1),(2,2),(2,3),(2,4),(2,5)  → note: base form נ not ן
#   אבטיח → (3,1),(3,2),(3,3),(3,4),(3,5) wait - let me recalculate
#   מנגו  → (5,0),(5,1),(5,2),(5,3)

puzzle = {
    "theme": "פירות",
    "grid": [
        ["ת", "פ", "ו", "ח", "כ", "ת"],
        ["א", "ג", "ס", "מ", "נ", "ג"],
        ["ו", "ל", "י", "מ", "ו", "נ"],
        ["א", "ב", "ט", "י", "ח", "ע"],
        ["נ", "ב", "א", "נ", "נ", "ה"],
        ["מ", "נ", "ג", "ו", "ל", "ד"],
        ["ש", "ז", "ר", "ב", "נ", "א"],
        ["ס", "ק", "י", "ו", "י", "ב"],
    ],
    # spangram: תפוחכת — row 0, all 6 cols
    "spangram_cells": [
        {"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2},
        {"row": 0, "col": 3}, {"row": 0, "col": 4}, {"row": 0, "col": 5},
    ],
    "word_cells": [
        # אגס (pear): row 1 cols 0-2
        [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}],
        # לימונ (lemon): row 2 cols 1-5
        [{"row": 2, "col": 1}, {"row": 2, "col": 2}, {"row": 2, "col": 3}, {"row": 2, "col": 4}, {"row": 2, "col": 5}],
        # אבטיח (watermelon): row 3 cols 0-4
        [{"row": 3, "col": 0}, {"row": 3, "col": 1}, {"row": 3, "col": 2}, {"row": 3, "col": 3}, {"row": 3, "col": 4}],
        # מנגו (mango): row 5 cols 0-3
        [{"row": 5, "col": 0}, {"row": 5, "col": 1}, {"row": 5, "col": 2}, {"row": 5, "col": 3}],
    ],
    "scheduled_date": str(date.today()),
}

body = json.dumps(puzzle).encode()
req = urllib.request.Request(
    "https://machrozot.up.railway.app/api/puzzle",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))
