import { useSettingsContext } from '../context/SettingsContext'

const LANGS = [
  { code: 'sk', flag: '🇸🇰', label: 'SK' },
  { code: 'cs', flag: '🇨🇿', label: 'CS' },
  { code: 'pl', flag: '🇵🇱', label: 'PL' },
  { code: 'hu', flag: '🇭🇺', label: 'HU' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
] as const

interface LanguageSwitcherProps {
  onLanguageChange?: (lang: string) => void
}

export function LanguageSwitcher({ onLanguageChange }: LanguageSwitcherProps = {}) {
  const { settings, updateSettings } = useSettingsContext()
  const current = settings.language || 'en'

  function handleChange(code: string) {
    updateSettings({ language: code })
    onLanguageChange?.(code)
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {LANGS.map(({ code, flag, label }) => {
        const active = current === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => handleChange(code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderRadius: 8,
              border: `1.5px solid ${active ? 'var(--violet)' : 'var(--border)'}`,
              background: active ? 'rgba(124,58,237,0.12)' : 'var(--bg2)',
              color: active ? 'var(--violet)' : 'var(--text3)',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
            title={code.toUpperCase()}
          >
            <span style={{ fontSize: 14 }}>{flag}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
