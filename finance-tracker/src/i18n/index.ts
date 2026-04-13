import { sk, type Translations } from './sk'
import { en } from './en'
import { useSettingsContext } from '../context/SettingsContext'

export { sk, en }
export type { Translations }

export function useTranslation() {
  const { settings } = useSettingsContext()
  const t: Translations = settings.language === 'en' ? en : sk
  return { t }
}
