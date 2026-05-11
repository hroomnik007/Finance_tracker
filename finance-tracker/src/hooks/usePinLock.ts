import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { savePin, deletePin, pinLogin, webauthnAuthenticateOptions, webauthnAuthenticateVerify } from '../api/auth'
import { startAuthentication } from '@simplewebauthn/browser'

const LOCK_METHOD_KEY = 'lock_method'
const AUTO_LOCK_MS = 5 * 60 * 1000

export function usePinLock() {
  const { user, refreshUser } = useAuth()
  const [lockMethod, setLockMethod] = useState<'pin' | 'biometric' | null>(
    () => localStorage.getItem(LOCK_METHOD_KEY) as 'pin' | 'biometric' | null
  )
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockMethodRef = useRef(lockMethod)
  lockMethodRef.current = lockMethod

  const hasPin = lockMethod === 'pin'
  const hasBiometric = lockMethod === 'biometric'

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
    const handler = () => { if (document.hidden) setLocked(true) }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [lockMethod])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== LOCK_METHOD_KEY) return
      const next = e.newValue as 'pin' | 'biometric' | null
      setLockMethod(next)
      if (!next) setLocked(false)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

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

  const setupBiometric = useCallback(() => {
    localStorage.setItem(LOCK_METHOD_KEY, 'biometric')
    setLockMethod('biometric')
    setLocked(false)
    resetTimer()
  }, [resetTimer])

  const verifyBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const options = await webauthnAuthenticateOptions(user?.email)
      const credential = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
      await webauthnAuthenticateVerify(credential)
      setLocked(false)
      resetTimer()
      return true
    } catch {
      return false
    }
  }, [user, resetTimer])

  const removeBiometric = useCallback(() => {
    localStorage.removeItem(LOCK_METHOD_KEY)
    setLockMethod(null)
    setLocked(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return {
    hasPin, hasBiometric, lockMethod, locked,
    setupPin, verifyPin, removePin,
    setupBiometric, verifyBiometric, removeBiometric,
  }
}
