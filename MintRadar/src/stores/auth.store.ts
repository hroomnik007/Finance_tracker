import { create } from 'zustand'

interface AuthState {
  pubkeyHex: string | null
}

export const useAuthStore = create<AuthState>()(() => ({
  pubkeyHex: null,
}))
