"""
Seeds today's puzzle: theme "יפה עיניים".

Uses the admin word-list creation API — the grid itself is generated
automatically by generate_grid(), no manual grid/cell layout needed.

Usage:
  python backend/scripts/seed_yafe_einaim.py
  API_URL=https://your-app.railway.app python backend/scripts/seed_yafe_einaim.py

Requires ADMIN_PASSWORD in the environment, or in a .env file at the repo root.
"""

import json
import os
import pathlib
import threading
import urllib.error
import urllib.request
from datetime import date

from tqdm import tqdm

API_URL = os.environ.get("API_URL", "http://localhost:8000")

THEME = "יפה עיניים"  # King David's story (יפה עיניים describes David in 1 Samuel 16:12)
MEGA_MACHROZET = "דודבנישי"
WORDS = ["יהונתנ", "אמנונ", "תהילימ", "אבשלומ", "בתשבע", "גוליית", "ביתלחמ"]


def _load_admin_password() -> str:
    if "ADMIN_PASSWORD" in os.environ:
        return os.environ["ADMIN_PASSWORD"]
    env_file = pathlib.Path(__file__).resolve().parents[2] / ".env"
    for line in env_file.read_text().splitlines():
        if line.startswith("ADMIN_PASSWORD="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("ADMIN_PASSWORD not set in environment or .env")


ADMIN_PASSWORD = _load_admin_password()


def admin_request(path: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{API_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json", "x-admin-password": ADMIN_PASSWORD},
        method=method,
    )
    with urllib.request.urlopen(request) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def admin_request_with_progress(desc: str, path: str, method: str = "GET", body: dict | None = None):
    """Same as admin_request, but shows a live elapsed-time progress bar —
    grid placement can legitimately take anywhere from a few seconds to a
    couple of minutes (it's a randomized backtracking search), and a plain
    blocking HTTP call gives no sign it's still working, not stuck."""
    result: dict = {}

    def run():
        result["value"] = admin_request(path, method=method, body=body)

    thread = threading.Thread(target=run)
    thread.start()
    with tqdm(desc=desc, unit="s", bar_format="{desc}: {elapsed} elapsed") as bar:
        while thread.is_alive():
            thread.join(timeout=0.2)
            bar.update(1)
    return result["value"]


today = str(date.today())

try:
    existing = admin_request(f"/api/admin/schedule/{today}")
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    existing = None

if existing is not None:
    print(f"puzzle {existing['id']} already scheduled for {today} — skipping generation")
else:
    puzzle = admin_request_with_progress(
        "Generating grid",
        "/api/admin/puzzles",
        method="POST",
        body={"theme": THEME, "mega_machrozet": MEGA_MACHROZET, "words": WORDS},
    )
    print(json.dumps(puzzle, ensure_ascii=False, indent=2))
    admin_request(f"/api/admin/schedule/{today}", method="POST", body={"puzzle_id": puzzle["id"]})
    print(f"scheduled puzzle {puzzle['id']} for {today}")
