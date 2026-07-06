import { apiClient } from './client'

export type NotificationFeedItem =
  | { id: string; kind: 'budget'; categoryName: string; spent: number; limit: number }
  | { id: string; kind: 'fixedDue'; label: string; dayOfMonth: number; daysUntil: number; amount: number }
  | { id: string; kind: 'income'; description: string | null; amount: number; daysAgo: number }
  | { id: string; kind: 'savings'; name: string; icon: string | null; savedAmount: number; targetAmount: number }

export interface NotificationFeed {
  data: NotificationFeedItem[]
  dismissed: string[]
}

/** Server-computed feed; `today` is the client's local date (YYYY-MM-DD). */
export function getNotificationFeed(today: string): Promise<NotificationFeed> {
  return apiClient.get<NotificationFeed>('/api/notifications/feed', { params: { today } }).then(r => r.data)
}

export function getDismissedNotifications(): Promise<{ data: string[] }> {
  return apiClient.get<{ data: string[] }>('/api/notifications/dismissed').then(r => r.data)
}

export function dismissNotification(key: string): Promise<void> {
  return apiClient.post('/api/notifications/dismiss', { key }).then(() => undefined)
}
