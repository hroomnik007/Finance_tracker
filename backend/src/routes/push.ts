import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { pushSubscriptions } from '../db/schema'
import { authenticateToken, AuthRequest } from '../middleware/authenticate'
import { sendPushNotification } from '../lib/webpush'
import type { Response } from 'express'

const router = Router()

router.use(authenticateToken)

router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { endpoint, keys, userAgent } = req.body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
    userAgent?: string
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription object' })
    return
  }

  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    })

  res.json({ ok: true })
})

router.delete('/subscribe', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { endpoint } = req.body as { endpoint: string }

  if (!endpoint) {
    res.status(400).json({ error: 'endpoint required' })
    return
  }

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))

  res.json({ ok: true })
})

router.post('/test', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  const results = await Promise.allSettled(
    subs.map(s =>
      sendPushNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        'Finvu test',
        'Push notifikácie fungujú! 🎉',
        '/logo.svg'
      )
    )
  )

  const failed = results.filter(r => r.status === 'rejected').length
  res.json({ sent: results.length - failed, failed })
})

export default router
