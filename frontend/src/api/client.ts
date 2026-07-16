export interface CellPosition {
  row: number
  col: number
}

export interface PuzzlePublic {
  id: number
  theme: string
  grid: string[][]
  word_count: number
  mega_machrozet: string
  words: string[]
  mega_machrozet_cells: CellPosition[]
  word_cells: CellPosition[][]
  bonus_words: string[]
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  getTodayPuzzle: () => request<PuzzlePublic>('/api/puzzle/today'),
  getPuzzleById: (id: number) => request<PuzzlePublic>(`/api/puzzle/${id}`),
  getPuzzleByDate: (date: string) => request<PuzzlePublic>(`/api/puzzle/date/${date}`),
}
