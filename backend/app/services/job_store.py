import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

JobStatus = Literal["pending", "done", "error"]
JobKind = Literal["create", "shuffle"]


@dataclass
class Job:
    kind: JobKind
    started_at: float
    # None for creation jobs until generation finishes and the row exists.
    puzzle_id: int | None = None
    # Carried on the job itself: for a creation job there's no Puzzle row yet,
    # so this is the only place the admin UI can show what's being generated.
    theme: str = ""
    mega_machrozet: str = ""
    words: list[str] = field(default_factory=list)
    status: JobStatus = "pending"
    result: Any = None
    detail: str = ""


_jobs: dict[str, Job] = {}
_latest_job_by_puzzle: dict[int, str] = {}


def create_job(
    kind: JobKind,
    *,
    puzzle_id: int | None = None,
    theme: str = "",
    mega_machrozet: str = "",
    words: list[str] | None = None,
) -> str:
    job_id = uuid.uuid4().hex
    _jobs[job_id] = Job(
        kind=kind,
        started_at=time.time(),
        puzzle_id=puzzle_id,
        theme=theme,
        mega_machrozet=mega_machrozet,
        words=list(words or []),
    )
    if puzzle_id is not None:
        _latest_job_by_puzzle[puzzle_id] = job_id
    return job_id


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def get_latest_job_for_puzzle(puzzle_id: int) -> Job | None:
    """The most recent generation job (creation or shuffle) for this puzzle —
    lets the admin UI resume watching progress after navigating away and back,
    without needing to remember a job_id itself."""
    job_id = _latest_job_by_puzzle.get(puzzle_id)
    return _jobs.get(job_id) if job_id else None


def get_latest_job_entry_for_puzzle(puzzle_id: int) -> tuple[str | None, Job | None]:
    """Like get_latest_job_for_puzzle, but also returns the job_id — needed
    when the caller reports the job back to the UI (e.g. for dismissal)."""
    job_id = _latest_job_by_puzzle.get(puzzle_id)
    job = _jobs.get(job_id) if job_id else None
    return (job_id if job else None), job


def list_jobs() -> list[tuple[str, Job]]:
    """All tracked jobs, newest first."""
    return sorted(_jobs.items(), key=lambda item: -item[1].started_at)


def discard_job(job_id: str) -> bool:
    job = _jobs.pop(job_id, None)
    if job is None:
        return False
    if job.puzzle_id is not None and _latest_job_by_puzzle.get(job.puzzle_id) == job_id:
        del _latest_job_by_puzzle[job.puzzle_id]
    return True


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
