import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { savePin, deletePin, pinLogin, sessionCheck } from '../api/auth'

const LOCK_METHOD_KEY = 'lock_method'
const AUTO_LOCK_MS = 5 * 60 * 1000

export function usePinLock() {
  const { user, refreshUser } = useAuth()
  const [lockMethod, setLockMethod] = useState<'pin' | null>(
    () => {
      const v = localStorage.getItem(LOCK_METHOD_KEY)
      return v === 'pin' ? 'pin' : null
    }
  )
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockMethodRef = useRef(lockMethod)
  lockMethodRef.current = lockMethod

  const hasPin = lockMethod === 'pin'
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  const resetTimer = useCallback(() => {
    if (!lockMethod) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), AUTO_LOCK_MS)
  }, [lockMethod])

  useEffect(() => {
    if (!lockMethod || locked) return
    resetTimer()
    const onActivity = () => resetTimer()
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lockMethod, locked, resetTimer])

  useEffect(() => {
    if (!lockMethod) return
    let hiddenAt: number | null = null
    const handler = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else {
        if (hiddenAt !== null && Date.now() - hiddenAt > AUTO_LOCK_MS) {
          setLocked(true)
        }
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [lockMethod])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== LOCK_METHOD_KEY) return
      const next = e.newValue === 'pin' ? 'pin' : null
      setLockMethod(next)
      if (!next) setLocked(false)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Server-side session timeout check
  useEffect(() => {
    if (!lockMethod || !user) return

    async function checkSession() {
      if (lockedRef.current) return
      try {
        const result = await sessionCheck()
        if (!result.valid && result.reason === 'timeout') {
          setLocked(true)
        }
      } catch { /* network errors must not lock user out */ }
    }

    // Check on mount (app load / user change)
    checkSession()

    // Check when tab becomes visible — do NOT act on hidden
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkSession()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Poll every 60s, only when tab is visible
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') checkSession()
    }, 60_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(intervalId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockMethod, user])

  // Sync lockMethod with server on user load — resolves cross-device desync
  useEffect(() => {
    if (!user) return
    const serverHasPin = !!user.has_pin
    const current = lockMethodRef.current
    if (!serverHasPin && current === 'pin') {
      localStorage.removeItem(LOCK_METHOD_KEY)
      setLockMethod(null)
      setLocked(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    } else if (serverHasPin && current === null) {
      localStorage.setItem(LOCK_METHOD_KEY, 'pin')
      setLockMethod('pin')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const setupPin = useCallback(async (pin: string) => {
    await savePin(pin)
    localStorage.setItem(LOCK_METHOD_KEY, 'pin')
    setLockMethod('pin')
    setLocked(false)
    resetTimer()
  }, [resetTimer])

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!user?.email) return false
    try {
      await pinLogin(user.email, pin)
      setLocked(false)
      resetTimer()
      return true
    } catch {
      return false
    }
  }, [user, resetTimer])

  const removePin = useCallback(async () => {
    await deletePin()
    localStorage.removeItem(LOCK_METHOD_KEY)
    setLockMethod(null)
    setLocked(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    refreshUser()
  }, [refreshUser])

  return {
    hasPin, lockMethod, locked,
    setupPin, verifyPin, removePin,
  }
}
