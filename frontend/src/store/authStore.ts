import { create } from 'zustand'
import { authApi, authToken, type UserPublic } from '../api/client'

interface AuthState {
  user: UserPublic | null
  // True once the startup fetchMe has settled — lets UI wait before deciding
  // whether someone is logged out or just still loading.
  initialized: boolean

  loginWithGoogle: (credential: string) => Promise<void>
  fetchMe: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,

  loginWithGoogle: async (credential) => {
    const response = await authApi.loginWithGoogle(credential)
    authToken.set(response.access_token)
    set({ user: response.user, initialized: true })
  },

  fetchMe: async () => {
    if (!authToken.get()) {
      set({ user: null, initialized: true })
      return
    }
    try {
      const user = await authApi.getMe()
      set({ user, initialized: true })
    } catch {
      // authedRequest already cleared an invalid token on 401.
      set({ user: null, initialized: true })
    }
  },

  // Only the identity is dropped — localStorage game progress stays, so the
  // player seamlessly degrades to anonymous play.
  logout: () => {
    authToken.clear()
    set({ user: null })
  },
}))
