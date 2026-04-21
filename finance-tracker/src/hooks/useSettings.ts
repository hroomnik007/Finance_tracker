import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { DEFAULT_SETTINGS } from '../types'
import type { AppSettings } from '../types'

export function useSettings(): AppSettings {
  const rows = useLiveQuery(() => db.settings.toArray(), [])

  if (!rows) return DEFAULT_SETTINGS

  const map: Record<string, string | number | boolean> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }

  return {
    currency:       (map['currency'] as string)       ?? DEFAULT_SETTINGS.currency,
    language:       (map['language'] as string)       ?? DEFAULT_SETTINGS.language,
    dateFormat:     (map['dateFormat'] as string)     ?? DEFAULT_SETTINGS.dateFormat,
    firstDayOfWeek: (map['firstDayOfWeek'] as string) ?? DEFAULT_SETTINGS.firstDayOfWeek,
  }
}

export async function setSetting(key: string, value: string | number | boolean) {
  await db.settings.put({ key, value })
}
