import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { db } from '../db/database'
import { DEFAULT_SETTINGS } from '../types'
import type { AppSettings } from '../types'

interface SettingsContextValue {
  settings: AppSettings
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  refreshSettings: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  // Wait for DB load before rendering — prevents language flash on startup
  const [loaded, setLoaded] = useState(false)

  const loadSettings = async () => {
    const rows = await db.settings.toArray()
    const map: Record<string, string | number | boolean> = {}
    for (const row of rows) map[row.key] = row.value
    setSettings({
      currency:       (map['currency'] as string)       ?? DEFAULT_SETTINGS.currency,
      language:       (map['language'] as string)       ?? DEFAULT_SETTINGS.language,
      dateFormat:     (map['dateFormat'] as string)     ?? DEFAULT_SETTINGS.dateFormat,
      firstDayOfWeek: (map['firstDayOfWeek'] as string) ?? DEFAULT_SETTINGS.firstDayOfWeek,
    })
    setLoaded(true)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings: loadSettings }}>
      {loaded
        ? children
        : <div style={{ minHeight: '100svh', backgroundColor: '#1E1535' }} />
      }
    </SettingsContext.Provider>
  )
}

export function useSettingsContext() {
  return useContext(SettingsContext)
}
