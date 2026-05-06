import { useEffect } from 'react'
import { subscribePush } from '../api/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function isMobileDevice(): boolean {
  return (
    window.innerWidth < 1024 ||
    /Mobile|Android/i.test(navigator.userAgent)
  )
}

export function usePushSubscription(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!isMobileDevice()) return
    if (localStorage.getItem('push_subscribed') === 'true') return

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function subscribe() {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })

        await subscribePush(subscription, navigator.userAgent)
        localStorage.setItem('push_subscribed', 'true')
      } catch {
        // fail silently — old browser or user denied
      }
    }

    subscribe()
  }, [isAuthenticated])
}
