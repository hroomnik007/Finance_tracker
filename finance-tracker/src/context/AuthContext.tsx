import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { setAccessToken } from '../api/client'
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  refreshToken,
  getMe,
  deleteAccount as apiDeleteAccount,
  demoLogin as apiDemoLogin,
} from '../api/auth'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isGuest: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  loginDemo: () => Promise<void>
  register: (email: string, password: string, name: string, gdprConsent: boolean) => Promise<void>
  loginAsGuest: () => void
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isGuest: false,
  login: async () => {},
  loginDemo: async () => {},
  register: async () => {},
  loginAsGuest: () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)

  const doLogout = useCallback(async (callApi = true) => {
    try {
      if (callApi && !isGuest) await apiLogout()
    } catch { /* ignore */ }
    setAccessToken(null)
    setUser(null)
    setIsGuest(false)
    try {
      sessionStorage.removeItem('auth_guest')
      localStorage.removeItem('auth_remember')
      localStorage.removeItem('category_budget_limits')
    } catch { /* ignore */ }
  }, [isGuest])

  useEffect(() => {
    const guestFlag =
      sessionStorage.getItem('auth_guest') === 'true' ||
      localStorage.getItem('auth_guest') === 'true'

    if (guestFlag) {
      setIsGuest(true)
      setIsLoading(false)
      return
    }

    refreshToken()
      .then(({ accessToken }) => {
        setAccessToken(accessToken)
        return getMe()
      })
      .then(({ user: me }) => setUser(me))
      .catch(() => { /* no valid session */ })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => doLogout(false)
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [doLogout])

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    const { user: me, accessToken } = await apiLogin(email, password)
    setAccessToken(accessToken)
    setUser(me)
    setIsGuest(false)
    try {
      if (rememberMe) localStorage.setItem('auth_remember', 'true')
      sessionStorage.removeItem('auth_guest')
      localStorage.removeItem('auth_guest')
    } catch { /* ignore */ }
  }, [])

  const loginDemo = useCallback(async () => {
    const { user: me, accessToken } = await apiDemoLogin()
    setAccessToken(accessToken)
    setUser(me)
    setIsGuest(false)
    try {
      sessionStorage.removeItem('auth_guest')
      localStorage.removeItem('auth_guest')
    } catch { /* ignore */ }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await getMe()
      setUser(me)
    } catch { /* ignore */ }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string, gdprConsent: boolean) => {
    // Registration now sends verification email; user is NOT logged in yet
    await apiRegister(email, password, name, gdprConsent)
  }, [])

  const loginAsGuest = useCallback(() => {
    setIsGuest(true)
    setUser(null)
    try { sessionStorage.setItem('auth_guest', 'true') } catch { /* ignore */ }
  }, [])

  const logout = useCallback(() => doLogout(true), [doLogout])

  const deleteAccount = useCallback(async () => {
    await apiDeleteAccount()
    await doLogout(false)
  }, [doLogout])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user || isGuest,
        isLoading,
        isGuest,
        login,
        loginDemo,
        register,
        loginAsGuest,
        logout,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
