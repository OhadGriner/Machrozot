"""
Seeds today's puzzle: theme "יפה עיניים".

Uses the admin word-list creation API — the grid itself is generated
automatically by generate_grid(), no manual grid/cell layout needed.

Usage:
  python backend/scripts/seed_yafe_einaim.py
  API_URL=https://your-app.railway.app ADMIN_TOKEN=<jwt> python backend/scripts/seed_yafe_einaim.py

Auth: admin endpoints require a Google-account JWT. Locally the script
bootstraps one itself — it upserts an admin user (first email in ADMIN_EMAILS)
straight into the dev DB and signs a token with the same SECRET_KEY the server
uses (both read from the repo-root .env). Against a remote API, pass a ready
ADMIN_TOKEN instead (grab one from the browser's localStorage `authToken`
after signing in as an admin).
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


def _load_root_env() -> dict[str, str]:
    env_file = pathlib.Path(__file__).resolve().parents[2] / ".env"
    values: dict[str, str] = {}
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip()
    return values


def _mint_local_admin_token() -> str:
    """Dev bootstrap: make sure an admin user row exists in the local DB and
    sign a JWT for it with the server's own SECRET_KEY."""
    import asyncio
    import sys

    # Running as `python scripts/seed_yafe_einaim.py` puts scripts/ (not
    # backend/) on sys.path — add backend/ so `app.*` imports resolve.
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

    for key, value in _load_root_env().items():
        os.environ.setdefault(key, value)
    # The .env DATABASE_URL points at docker's internal hostname; from the
    # host machine the same Postgres is reachable on localhost.
    os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "").replace("@db:", "@localhost:")

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.user import User
    from app.services.auth_service import create_access_token

    admin_email = next((e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()), None)
    if not admin_email:
        raise RuntimeError("ADMIN_EMAILS is empty — set it in the repo-root .env")

    async def bootstrap() -> str:
        engine = create_async_engine(settings.database_url)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            result = await session.execute(select(User).where(User.email == admin_email))
            user = result.scalars().first()
            if user is None:
                user = User(
                    google_sub=f"local-seed:{admin_email}",
                    email=admin_email,
                    name="Local Seed Admin",
                    picture_url=None,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
            token = create_access_token(user)
        await engine.dispose()
        return token

    return asyncio.run(bootstrap())


ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN") or _mint_local_admin_token()


def admin_request(path: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{API_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN_TOKEN}"},
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
