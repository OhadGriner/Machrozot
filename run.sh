#!/usr/bin/env bash
# One-shot dev launcher: backend (docker) + frontend (vite) + seeds today's puzzle.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> starting db + backend + adminer"
docker compose up -d db backend adminer

echo "==> waiting for backend"
until curl -sf http://localhost:8000/docs >/dev/null 2>&1; do sleep 1; done

echo "==> seeding today's puzzle (יפה עיניים)"
python3 backend/scripts/seed_yafe_einaim.py || echo "   (seed skipped — puzzle may already exist for today)"

echo "==> starting frontend"
cd frontend
npm install --silent
npm run dev
