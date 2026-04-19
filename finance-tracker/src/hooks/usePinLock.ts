import { useState, useEffect, useCallback, useRef } from 'react'

const PIN_HASH_KEY = 'pin_hash'
const AUTO_LOCK_MS = 5 * 60 * 1000

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function usePinLock() {
  const [hasPin, setHasPin] = useState(() => !!localStorage.getItem(PIN_HASH_KEY))
  const [locked, setLocked] = useState(() => !!localStorage.getItem(PIN_HASH_KEY))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (!hasPin) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), AUTO_LOCK_MS)
  }, [hasPin])

  useEffect(() => {
    if (!hasPin || locked) return
    resetTimer()
    const onActivity = () => resetTimer()
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [hasPin, locked, resetTimer])

  useEffect(() => {
    if (!hasPin) return
    const handler = () => { if (document.hidden) setLocked(true) }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [hasPin])

  const setupPin = useCallback(async (pin: string) => {
    const hash = await sha256(pin)
    localStorage.setItem(PIN_HASH_KEY, hash)
    setHasPin(true)
    setLocked(false)
    resetTimer()
  }, [resetTimer])

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = localStorage.getItem(PIN_HASH_KEY)
    if (!stored) return false
    const hash = await sha256(pin)
    if (hash === stored) {
      setLocked(false)
      resetTimer()
      return true
    }
    return false
  }, [resetTimer])

  const removePin = useCallback(() => {
    localStorage.removeItem(PIN_HASH_KEY)
    setHasPin(false)
    setLocked(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { hasPin, locked, setupPin, verifyPin, removePin }
}
