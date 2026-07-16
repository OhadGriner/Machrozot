import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

JobStatus = Literal["pending", "done", "error"]


@dataclass
class Job:
    puzzle_id: int
    started_at: float
    status: JobStatus = "pending"
    result: Any = None
    detail: str = ""


_jobs: dict[str, Job] = {}
_latest_job_by_puzzle: dict[int, str] = {}


def create_job(puzzle_id: int) -> str:
    job_id = uuid.uuid4().hex
    _jobs[job_id] = Job(puzzle_id=puzzle_id, started_at=time.time())
    _latest_job_by_puzzle[puzzle_id] = job_id
    return job_id


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def get_latest_job_for_puzzle(puzzle_id: int) -> Job | None:
    """The most recent shuffle job for this puzzle (running, or its last
    result) — lets the admin UI resume watching progress after navigating
    away and back, without needing to remember a job_id itself."""
    job_id = _latest_job_by_puzzle.get(puzzle_id)
    return _jobs.get(job_id) if job_id else None


def resolve_job(job_id: str, result: Any) -> None:
    job = _jobs[job_id]
    job.status = "done"
    job.result = result


def fail_job(job_id: str, detail: str) -> None:
    job = _jobs[job_id]
    job.status = "error"
    job.detail = detail


def reset() -> None:
    """Test-only: clears all tracked jobs. Without this, these module-level
    dicts persist across the whole test session while each test's DB resets
    puzzle ids back to 1, letting a stale job from an earlier test collide
    with a later test's same-numbered puzzle."""
    _jobs.clear()
    _latest_job_by_puzzle.clear()
