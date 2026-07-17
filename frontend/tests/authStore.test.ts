import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../src/store/authStore'
import type { UserPublic } from '../src/api/client'

const USER: UserPublic = {
  id: 1,
  email: 'player@example.com',
  name: 'Player',
  picture_url: null,
  is_admin: false,
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: null, initialized: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authStore', () => {
  it('login stores the token and user', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { access_token: 'jwt-abc', token_type: 'bearer', user: USER })
    )

    await useAuthStore.getState().loginWithGoogle('google-credential')

    expect(localStorage.getItem('authToken')).toBe('jwt-abc')
    expect(useAuthStore.getState().user).toEqual(USER)
    expect(useAuthStore.getState().initialized).toBe(true)
  })

  it('fetchMe with no token resolves to logged out without a network call', async () => {
    const fetchSpy = mockFetch(200, USER)
    vi.stubGlobal('fetch', fetchSpy)

    await useAuthStore.getState().fetchMe()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().initialized).toBe(true)
  })

  it('fetchMe clears an invalid token on 401', async () => {
    localStorage.setItem('authToken', 'expired-jwt')
    vi.stubGlobal('fetch', mockFetch(401, { detail: 'Invalid token' }))

    await useAuthStore.getState().fetchMe()

    expect(localStorage.getItem('authToken')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().initialized).toBe(true)
  })

  it('logout clears identity but keeps saved game progress', () => {
    localStorage.setItem('authToken', 'jwt-abc')
    localStorage.setItem('gameProgress-7', '{"foundWords":[]}')
    useAuthStore.setState({ user: USER, initialized: true })

    useAuthStore.getState().logout()

    expect(localStorage.getItem('authToken')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('gameProgress-7')).toBe('{"foundWords":[]}')
  })
})
