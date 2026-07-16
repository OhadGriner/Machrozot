const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const STORAGE_KEY = 'adminPassword'

export const adminAuth = {
  set: (password: string) => sessionStorage.setItem(STORAGE_KEY, password),
  get: () => sessionStorage.getItem(STORAGE_KEY) ?? '',
  clear: () => sessionStorage.removeItem(STORAGE_KEY),
  isSet: () => !!sessionStorage.getItem(STORAGE_KEY),
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminAuth.get(),
      ...options?.headers,
    },
  })
  if (response.status === 401) {
    adminAuth.clear()
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

export interface ShuffleStatus {
  status: 'none' | 'pending' | 'done' | 'error'
  elapsed_seconds: number
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

  createLevel: (data: LevelWordsData) =>
    request<LevelGridDetail>('/api/admin/puzzles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
    request<ShuffleStatus>(`/api/admin/puzzles/${id}/shuffle`, {
      method: 'POST',
    }),

  // State of the most recent shuffle job for this puzzle, if any — used both
  // to poll an in-progress shuffle and to check on mount whether one is
  // already running (so progress survives navigating away and back).
  getShuffleStatus: (id: number) =>
    request<ShuffleStatus>(`/api/admin/puzzles/${id}/shuffle-status`),
}
