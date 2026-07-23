// Minimal pub/sub so a freshly created transaction (income, expense, fixed
// expense) can prompt NotificationCenter to refetch immediately instead of
// waiting for its periodic poll or a focus/visibility event — mirrors the
// same pattern used by achievementEvents.ts.
type Listener = () => void

const listeners = new Set<Listener>()

export function subscribeNotificationsRefresh(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function announceNotificationsRefresh(): void {
  listeners.forEach(fn => fn())
}
