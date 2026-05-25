import { apiClient } from './client'

export function getDismissedNotifications(): Promise<{ data: string[] }> {
  return apiClient.get<{ data: string[] }>('/notifications/dismissed').then(r => r.data)
}

export function dismissNotification(key: string): Promise<void> {
  return apiClient.post('/notifications/dismiss', { key }).then(() => undefined)
}
