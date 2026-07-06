import { sk, type Translations } from './sk'
import { en } from './en'
import { cs } from './cs'
import { pl } from './pl'
import { hu } from './hu'
import { useSettingsContext } from '../context/SettingsContext'

export { sk, en, cs, pl, hu }
export type { Translations }

const SUPPORTED_LANGS = ['sk', 'cs', 'pl', 'hu', 'en'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

const TRANSLATIONS: Record<SupportedLang, Translations> = { sk, cs, pl, hu, en }

const LOCALE_MAP: Record<SupportedLang, string> = {
  sk: 'sk-SK', cs: 'cs-CZ', pl: 'pl-PL', hu: 'hu-HU', en: 'en-GB',
}

export function useTranslation() {
  const { settings } = useSettingsContext()
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(settings.language)
    ? (settings.language as SupportedLang)
    : 'en'
  return { t: TRANSLATIONS[lang], lang, locale: LOCALE_MAP[lang] }
}

// ── Localized date names (replaces hardcoded Slovak day/month arrays) ──────
// Index 0 = Sunday to match Date.getDay(); noon UTC guards against TZ shifts.
const dayNamesCache = new Map<string, string[]>()
const monthNamesCache = new Map<string, string[]>()

export function getLocalizedDayNames(locale: string): string[] {
  let names = dayNamesCache.get(locale)
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
    names = Array.from({ length: 7 }, (_, i) => {
      // 2023-01-01 was a Sunday
      const name = fmt.format(new Date(Date.UTC(2023, 0, 1 + i, 12)))
      return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
    })
    dayNamesCache.set(locale, names)
  }
  return names
}

export function getLocalizedMonthNames(locale: string): string[] {
  let names = monthNamesCache.get(locale)
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    names = Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2023, i, 1, 12))))
    monthNamesCache.set(locale, names)
  }
  return names
}
