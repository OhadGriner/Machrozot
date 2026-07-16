FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY backend/pyproject.toml .
RUN uv sync --no-dev

COPY backend/app/ app/
COPY backend/alembic/ alembic/
COPY backend/alembic.ini .

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
