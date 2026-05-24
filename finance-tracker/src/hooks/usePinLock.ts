import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { savePin, deletePin, pinLogin, sessionCheck, pingSession } from '../api/auth'

const LOCK_METHOD_KEY = 'lock_method'
const PIN_SESSION_KEY = 'pin_verified_session'

export function usePinLock() {
  const { user, refreshUser } = useAuth()
  const [lockMethod, setLockMethod] = useState<'pin' | null>(
    () => {
      const v = localStorage.getItem(LOCK_METHOD_KEY)
      return v === 'pin' ? 'pin' : null
    }
  )
  // Start locked if PIN is set AND this browser session hasn't verified yet.
  // sessionStorage persists across hard refresh but clears on tab close / logout.
  const [locked, setLocked] = useState(() => {
    const v = localStorage.getItem(LOCK_METHOD_KEY)
    if (v !== 'pin') return false
    return sessionStorage.getItem(PIN_SESSION_KEY) !== 'true'
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockMethodRef = useRef(lockMethod)
  lockMethodRef.current = lockMethod

  const hasPin = lockMethod === 'pin'
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  const autoLockMs = (user?.auto_lock_minutes ?? 5) * 60 * 1000

  // Always clear the session flag when locking so hard-refresh also shows PIN.
  const lockAndClearSession = useCallback(() => {
    sessionStorage.removeItem(PIN_SESSION_KEY)
    setLocked(true)
  }, [])

  const resetTimer = useCallback(() => {
    if (!lockMethod) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(lockAndClearSession, autoLockMs)
  }, [lockMethod, lockAndClearSession, autoLockMs])

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
        if (hiddenAt !== null && Date.now() - hiddenAt > autoLockMs) {
          lockAndClearSession()
        }
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [lockMethod, lockAndClearSession])

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

  // Mount-once check — runs before AuthContext sets user (mobile PWA cold open)
  useEffect(() => {
    if (!lockMethodRef.current) return
    async function check() {
      if (lockedRef.current) return
      try {
        const result = await sessionCheck()
        if (!result.valid && result.reason === 'timeout') {
          lockAndClearSession()
        }
      } catch { /* network errors must not lock user out */ }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Server-side session timeout check
  useEffect(() => {
    if (!lockMethod || !user) return

    async function checkSession() {
      if (lockedRef.current) return
      try {
        const result = await sessionCheck()
        if (!result.valid && result.reason === 'timeout') {
          lockAndClearSession()
        }
      } catch { /* network errors must not lock user out */ }
    }

    let hiddenSince: number | null = null

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now()
      } else if (document.visibilityState === 'visible') {
        const hiddenMs = hiddenSince !== null ? Date.now() - hiddenSince : 0
        hiddenSince = null
        if (hiddenMs > 4 * 60 * 1000) checkSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') pingSession().catch(() => {})
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

    // User just authenticated (e.g. PIN login from Login page).
    // If the session flag is already set but locked state is still true
    // (set at mount before login completed), unlock now so PinLock never shows.
    if (sessionStorage.getItem(PIN_SESSION_KEY) === 'true' && lockedRef.current) {
      setLocked(false)
      resetTimer()
    }

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

  // Clear session verification on logout so re-login requires PIN again
  const prevUserRef = useRef(user)
  useEffect(() => {
    const prev = prevUserRef.current
    prevUserRef.current = user
    if (prev !== null && user === null) {
      sessionStorage.removeItem(PIN_SESSION_KEY)
      // Reset locked state so next login via password/Google triggers PinLock
      if (lockMethodRef.current === 'pin') setLocked(true)
    }
  }, [user])

  const setupPin = useCallback(async (pin: string) => {
    await savePin(pin)
    localStorage.setItem(LOCK_METHOD_KEY, 'pin')
    sessionStorage.setItem(PIN_SESSION_KEY, 'true')
    setLockMethod('pin')
    setLocked(false)
    resetTimer()
  }, [resetTimer])

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!user?.email) return false
    try {
      await pinLogin(user.email, pin)
      sessionStorage.setItem(PIN_SESSION_KEY, 'true')
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
    sessionStorage.removeItem(PIN_SESSION_KEY)
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
