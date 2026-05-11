import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../types'
import type { AppSettings } from '../types'

const SETTINGS_KEY = 'app_settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persistSettings(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

interface SettingsContextValue {
  settings: AppSettings
  refreshSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => void
  profileName: string
  profileAvatar: string
  setProfile: (name: string, avatar: string) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  refreshSettings: async () => {},
  updateSettings: () => {},
  profileName: '',
  profileAvatar: '👤',
  setProfile: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  const [profileName, setProfileName] = useState<string>(
    () => localStorage.getItem('profile_name') ?? ''
  )
  const [profileAvatar, setProfileAvatar] = useState<string>(
    () => localStorage.getItem('profile_avatar') ?? '👤'
  )

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      persistSettings(next)
      return next
    })
  }, [])

  const refreshSettings = useCallback(async () => {
    setSettings(loadSettings())
  }, [])

  const setProfile = useCallback((name: string, avatar: string) => {
    localStorage.setItem('profile_name', name)
    localStorage.setItem('profile_avatar', avatar)
    setProfileName(name)
    setProfileAvatar(avatar)
  }, [])

  const contextValue = useMemo(() => ({
    settings,
    refreshSettings,
    updateSettings,
    profileName,
    profileAvatar,
    setProfile,
  }), [settings, refreshSettings, updateSettings, profileName, profileAvatar, setProfile])

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettingsContext() {
  return useContext(SettingsContext)
}
