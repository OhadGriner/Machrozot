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
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

export interface ScheduleEntry {
  date: string
  puzzle_id: number
  theme: string
}

export interface PuzzleAdminData {
  id: number
  theme: string
  grid: string[][]
  spangram_cells: { row: number; col: number }[]
  word_cells: { row: number; col: number }[][]
}

export const adminApi = {
  getSchedules: (start: string, end: string) =>
    request<ScheduleEntry[]>(`/api/admin/schedules?start=${start}&end=${end}`),

  getPuzzle: (date: string) =>
    request<PuzzleAdminData>(`/api/admin/puzzle/${date}`),

  savePuzzle: (date: string, data: object) =>
    request<unknown>(`/api/admin/puzzle/${date}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
