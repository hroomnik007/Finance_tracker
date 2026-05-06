import webpush from 'web-push'
import { env } from '../config/env'

let initialized = false

function init() {
  if (initialized) return
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('[webpush] VAPID keys not configured — push notifications disabled')
    return
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  initialized = true
}

init()

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  title: string,
  body: string,
  icon = '/logo.svg',
  url = '/'
): Promise<void> {
  if (!initialized) return
  const payload = JSON.stringify({ title, body, icon, url })
  await webpush.sendNotification(subscription, payload)
}
