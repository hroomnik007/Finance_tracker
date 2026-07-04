// Minimal pub/sub so API calls (transactions, savings, households, reports)
// can announce freshly-unlocked achievement keys without threading callbacks
// through every hook/component. Consumers: App.tsx (toast) and
// NotificationCenter.tsx (persistent bell entry).
type Listener = (keys: string[]) => void

const listeners = new Set<Listener>()

export function subscribeAchievementUnlocks(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function announceAchievementUnlocks(keys: unknown): void {
  if (!Array.isArray(keys) || keys.length === 0) return
  const stringKeys = keys.filter((k): k is string => typeof k === 'string')
  if (stringKeys.length === 0) return
  listeners.forEach(fn => fn(stringKeys))
}
