// Frontend port of the backend's parseUA (backend/src/controllers/auth.controller.ts,
// used there to populate userSessions.deviceName/browser at session-creation time).
// pin_device_tokens.label is stored as a raw User-Agent string instead, so the PIN
// devices list needs its own copy of the same parsing to render it the same way
// ("Android Phone", "Firefox 128", ...) as the Aktívne relácie section.
export function parseUserAgent(ua: string): { deviceName: string; browser: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  let browser = 'Unknown'
  if (/Chrome\/(\d+)/i.test(ua) && !/Chromium|OPR|Edg/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
  } else if (/Edg\/(\d+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ''}`
  } else if (/OPR\/(\d+)/i.test(ua)) {
    browser = `Opera ${ua.match(/OPR\/(\d+)/)?.[1] ?? ''}`
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari'
  }
  let deviceName = 'Desktop'
  if (/iPhone/i.test(ua)) deviceName = 'iPhone'
  else if (/iPad/i.test(ua)) deviceName = 'iPad'
  else if (/Android/i.test(ua)) deviceName = isMobile ? 'Android Phone' : 'Android Tablet'
  else if (/Mac/i.test(ua)) deviceName = 'Mac'
  else if (/Windows/i.test(ua)) deviceName = 'Windows PC'
  else if (/Linux/i.test(ua)) deviceName = 'Linux'
  return { deviceName, browser }
}
