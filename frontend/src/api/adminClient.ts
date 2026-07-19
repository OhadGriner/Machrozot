import { authToken } from './client'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = authToken.get()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (response.status === 401) {
    // Expired/invalid token — drop it and let the page redirect to login.
    authToken.clear()
    throw new Error('Unauthorized')
  }
  if (response.status === 403) {
    // Valid account but not an admin — keep the token (it's fine for the
    // game), just refuse admin access.
    throw new Error('Unauthorized')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? `${response.status} ${response.statusText}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export interface ScheduleEntry {
  date: string
  puzzle_id: number
  theme: string
}

export interface LevelSummary {
  id: number
  theme: string
  scheduled_dates: string[]
}

export interface LevelWordsData {
  theme: string
  mega_machrozet: string
  words: string[]
}

export interface LevelGridDetail {
  id: number
  theme: string
  grid: string[][]
  mega_machrozet_cells: { row: number; col: number }[]
  word_cells: { row: number; col: number }[][]
}

// Unified status shape for generation jobs (creation and shuffle both fill a
// puzzle's grid in the background) — also what the per-puzzle status
// endpoint returns, with status 'none' when the puzzle has no job history.
export interface AdminJob {
  job_id: string
  kind: 'create' | 'shuffle' | ''
  status: 'none' | 'pending' | 'done' | 'error'
  puzzle_id: number | null
  elapsed_seconds: number
  theme: string
  mega_machrozet: string
  words: string[]
  puzzle?: LevelGridDetail
  detail?: string
}

export const adminApi = {
  getSchedules: (start: string, end: string) =>
    request<ScheduleEntry[]>(`/api/admin/schedules?start=${start}&end=${end}`),

  getLevels: () =>
    request<LevelSummary[]>('/api/admin/puzzles'),

  getLevelGrid: (id: number) =>
    request<LevelGridDetail>(`/api/admin/puzzles/${id}`),

  // Creation is async: the server answers immediately with a background job
  // (generation can take minutes) — watch it via getJobs; the finished level
  // shows up in getLevels.
  createLevel: (data: LevelWordsData) =>
    request<AdminJob>('/api/admin/puzzles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getJobs: () => request<AdminJob[]>('/api/admin/jobs'),

  dismissJob: (jobId: string) =>
    request<void>(`/api/admin/jobs/${jobId}`, { method: 'DELETE' }),

  deleteLevel: (id: number) =>
    request<void>(`/api/admin/puzzles/${id}`, {
      method: 'DELETE',
    }),

  getScheduledLevel: (date: string) =>
    request<LevelGridDetail>(`/api/admin/schedule/${date}`),

  assignLevel: (date: string, puzzleId: number) =>
    request<void>(`/api/admin/schedule/${date}`, {
      method: 'POST',
      body: JSON.stringify({ puzzle_id: puzzleId }),
    }),

  unassignLevel: (date: string) =>
    request<void>(`/api/admin/schedule/${date}`, {
      method: 'DELETE',
    }),

  // Starts a shuffle, or resumes watching one already running for this puzzle
  // (e.g. triggered from another tab, or before a page reload) instead of
  // kicking off a wasteful duplicate.
  triggerShuffle: (id: number) =>
    request<AdminJob>(`/api/admin/puzzles/${id}/shuffle`, {
      method: 'POST',
    }),

  // State of the most recent shuffle job for this puzzle, if any — used both
  // to poll an in-progress shuffle and to check on mount whether one is
  // already running (so progress survives navigating away and back).
  getShuffleStatus: (id: number) =>
    request<AdminJob>(`/api/admin/puzzles/${id}/shuffle-status`),
}
