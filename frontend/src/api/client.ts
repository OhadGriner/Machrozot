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

export interface FeedbackCreate {
  message: string
  contact?: string
  context: string
}

export interface UserPublic {
  id: number
  email: string
  name: string | null
  picture_url: string | null
  is_admin: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserPublic
}

export interface ProgressPayload {
  progress: Record<string, unknown>
  active_seconds: number
  is_complete: boolean
}

export interface ProgressResponse extends ProgressPayload {
  updated_at: string
}

const AUTH_TOKEN_KEY = 'authToken'

export const authToken = {
  get: () => localStorage.getItem(AUTH_TOKEN_KEY),
  set: (token: string) => localStorage.setItem(AUTH_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(AUTH_TOKEN_KEY),
}

function authHeader(): Record<string, string> {
  const token = authToken.get()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function authedRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeader(), ...options?.headers },
  })
  if (response.status === 401) {
    // Expired/invalid token — drop it so the UI falls back to logged-out.
    authToken.clear()
    throw new Error('Unauthorized')
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  getTodayPuzzle: () => request<PuzzlePublic>('/api/puzzle/today'),
  getPuzzleById: (id: number) => request<PuzzlePublic>(`/api/puzzle/${id}`),
  getPuzzleByDate: (date: string) => request<PuzzlePublic>(`/api/puzzle/date/${date}`),
  submitFeedback: (data: FeedbackCreate) =>
    request('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
}

export const authApi = {
  loginWithGoogle: (credential: string) =>
    request<TokenResponse>('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    }),
  getMe: () => authedRequest<UserPublic>('/api/auth/me'),
}

export const progressApi = {
  get: async (puzzleId: number): Promise<ProgressResponse | null> => {
    try {
      return await authedRequest<ProgressResponse>(`/api/progress/${puzzleId}`)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('404')) return null
      throw error
    }
  },
  put: (puzzleId: number, payload: ProgressPayload) =>
    authedRequest<ProgressResponse>(`/api/progress/${puzzleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
}
