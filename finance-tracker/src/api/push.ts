import { apiClient } from './client'

export async function subscribePush(subscription: PushSubscription, userAgent: string): Promise<void> {
  const json = subscription.toJSON()
  await apiClient.post('/api/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent,
  })
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiClient.delete('/api/push/subscribe', { data: { endpoint } })
}
