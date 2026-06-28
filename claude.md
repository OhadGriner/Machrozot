# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hebrew Strands** — a full-stack Hebrew clone of NYT Strands. Players find themed words in a 8×6 letter grid where every cell is used exactly once. A special "spangram" word spans the board and reveals the theme.

The original scaffold prompt is preserved in `claude.md`. If the project hasn't been built yet, scaffold it per that spec (see Implementation Order below).

## Tech Stack

- **Frontend:** React + TypeScript, Vite, React Router v6, Zustand, Tailwind CSS
- **Backend:** Python 3.12, FastAPI (all routes async), SQLAlchemy with `asyncpg`, Alembic, python-jose + passlib (JWT), slowapi, APScheduler, Redis
- **Package manager:** `uv` (replaces pip/virtualenv — use `uv run`, `uv add`, `uv sync`)
- **Database:** PostgreSQL 16
- **Dev:** Docker Compose (db + redis + backend + frontend)

## Development Commands

```bash
# Start all services
docker compose up

# Backend setup (from backend/)
uv sync

# Backend only (from backend/)
uv run uvicorn app.main:app --reload

# Run Alembic migrations (from backend/)
uv run alembic upgrade head

# Backend tests (from backend/)
uv run pytest

# Add a dependency (from backend/)
uv add <package>

# Frontend dev server (from frontend/)
npm run dev

# Frontend type check + build
npm run build
```

## Project Structure

```
strands-he/
├── backend/app/
│   ├── main.py            # FastAPI app, CORS, routers
│   ├── config.py          # pydantic BaseSettings from .env
│   ├── database.py        # async SQLAlchemy engine + session
│   ├── models/            # puzzle.py (Puzzle, DailySchedule), user.py (User, GameSession)
│   ├── schemas/           # Pydantic request/response schemas
│   ├── routers/           # puzzle.py, game.py, auth.py
│   ├── services/          # puzzle_service.py (Redis cache), hebrew_utils.py
│   └── scheduler.py       # APScheduler daily puzzle rotation
├── frontend/src/
│   ├── pages/             # GamePage.tsx, ArchivePage.tsx
│   ├── components/        # Grid, Cell, ThemeBanner, WordPanel, HintBar, VictoryScreen
│   ├── store/gameStore.ts # Zustand store
│   ├── hooks/             # useSelection.ts, useWordCheck.ts
│   ├── utils/             # hebrewUtils.ts, shareUtils.ts
│   └── api/client.ts      # fetch wrapper
├── docker-compose.yml
└── .env.example
```

## Hebrew-Specific Rules

- Grid stores **bare Hebrew consonants only** — no nikud (vowel diacritics)
- **Final-letter normalization** (apply before any matching): ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ
- All UI is RTL (`dir="rtl"`)
- Font: Heebo or Frank Ruhl Libre (Google Fonts)
- `hebrew_utils.py` (backend) and `hebrewUtils.ts` (frontend) must agree on normalization — keep them in sync

## API Contract

- `GET /api/puzzle/today` — **never** include `word_cells` in the response (exposes answers)
- Word validation is client-side: concatenate selected letters → strip nikud → normalize finals → compare against word list
- The session PATCH only confirms progress; it does not re-validate words server-side

## Core Game Logic

**Selection** (`useSelection.ts`): cells must be 8-directionally adjacent to the previous, no revisiting within a stroke; releasing pointer fires word check.

**Word check** (`useWordCheck.ts`): normalize → compare. Spangram match → gold cell state. Non-theme valid words ≥4 letters increment `nonThemeCount`; every 3 earns 1 hint.

**Zustand store shape:**
```ts
{
  puzzle: Puzzle | null,
  grid: string[][],                       // 6 rows × 8 cols
  selectedCells: { row: number; col: number }[],
  cellStates: Record<string, CellState>,  // key: "row-col"
  foundWords: string[],
  hintsUsed: number,
  nonThemeCount: number,
  hintsEarned: number,
  isComplete: boolean,
}
```

## Implementation Order (when scaffolding from scratch)

1. `docker-compose.yml` + `.env.example`
2. Backend: `config.py`, `database.py`, models, Alembic init
3. Backend: `hebrew_utils.py` with unit tests
4. Backend: puzzle router + Redis-cached daily puzzle service
5. Frontend: Vite + React scaffold with Tailwind, RTL config, Hebrew font
6. Frontend: Zustand store + `useSelection` hook
7. Frontend: `Grid.tsx` + `Cell.tsx`
8. Frontend: wire everything on `GamePage.tsx`
