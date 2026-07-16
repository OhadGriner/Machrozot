from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, puzzle

app = FastAPI(title="Machrozot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(puzzle.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
