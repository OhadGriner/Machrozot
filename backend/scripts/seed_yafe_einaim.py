"""
Seeds today's puzzle: theme "יפה עיניים".
Usage:
  python backend/scripts/seed_yafe_einaim.py
  API_URL=https://your-app.railway.app python backend/scripts/seed_yafe_einaim.py
"""

import json
import os
import urllib.request
from datetime import date

API_URL = os.environ.get("API_URL", "http://localhost:8000")

# Grid is 8 rows x 6 cols of Hebrew consonants (no nikud, no final forms).
# Mirrored horizontally so it reads left-to-right the same as the source image
# under the app's RTL layout (col 0 renders on the right).
#
#   ב א י א י ה
#   ת ב ש מ נ ו
#   ש ש ל י ו נ
#   ע ב ו נ נ ת
#   ג ו מ ב מ נ
#   ב י ל ד ל י
#   מ י י ת ו י
#   ח ל ת ד ת ה
#
# Theme: King David's story (יפה עיניים describes David in 1 Samuel 16:12).
# spangram: "דודבנישי" starting bottom row, ending top row.
# words: יהונתנ, אמנונ, תהילימ, אבשלומ, בתשבע, גוליית, ביתלחמ

puzzle = {
    "theme": "יפה עיניים",
    "grid": [
        ["ב", "א", "י", "א", "י", "ה"],
        ["ת", "ב", "ש", "מ", "נ", "ו"],
        ["ש", "ש", "ל", "י", "ו", "נ"],
        ["ע", "ב", "ו", "נ", "נ", "ת"],
        ["ג", "ו", "מ", "ב", "מ", "נ"],
        ["ב", "י", "ל", "ד", "ל", "י"],
        ["מ", "י", "י", "ת", "ו", "י"],
        ["ח", "ל", "ת", "ד", "ת", "ה"],
    ],
    "spangram_cells": [
        {"row": 7, "col": 3}, {"row": 6, "col": 4}, {"row": 5, "col": 3}, {"row": 4, "col": 3},
        {"row": 3, "col": 3}, {"row": 2, "col": 3}, {"row": 1, "col": 2}, {"row": 0, "col": 2},
    ],
    "word_cells": [
        # יהונתנ
        [{"row": 0, "col": 4}, {"row": 0, "col": 5}, {"row": 1, "col": 5},
         {"row": 2, "col": 5}, {"row": 3, "col": 5}, {"row": 4, "col": 5}],
        # אמנונ
        [{"row": 0, "col": 3}, {"row": 1, "col": 3}, {"row": 1, "col": 4},
         {"row": 2, "col": 4}, {"row": 3, "col": 4}],
        # תהילימ
        [{"row": 7, "col": 4}, {"row": 7, "col": 5}, {"row": 6, "col": 5},
         {"row": 5, "col": 4}, {"row": 5, "col": 5}, {"row": 4, "col": 4}],
        # אבשלומ
        [{"row": 0, "col": 1}, {"row": 1, "col": 1}, {"row": 2, "col": 1},
         {"row": 2, "col": 2}, {"row": 3, "col": 2}, {"row": 4, "col": 2}],
        # בתשבע
        [{"row": 0, "col": 0}, {"row": 1, "col": 0}, {"row": 2, "col": 0},
         {"row": 3, "col": 1}, {"row": 3, "col": 0}],
        # גוליית
        [{"row": 4, "col": 0}, {"row": 4, "col": 1}, {"row": 5, "col": 2},
         {"row": 5, "col": 1}, {"row": 6, "col": 2}, {"row": 6, "col": 3}],
        # ביתלחמ
        [{"row": 5, "col": 0}, {"row": 6, "col": 1}, {"row": 7, "col": 2},
         {"row": 7, "col": 1}, {"row": 7, "col": 0}, {"row": 6, "col": 0}],
    ],
    "scheduled_date": str(date.today()),
}

body = json.dumps(puzzle).encode()
req = urllib.request.Request(
    f"{API_URL}/api/puzzle",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))
