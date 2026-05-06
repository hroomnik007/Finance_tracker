self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Finvu', {
      body: data.body ?? '',
      icon: data.icon ?? '/logo.svg',
      badge: '/logo.svg',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('financie.pedani.eu') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(self.registration.scope)
    })
  )
})
