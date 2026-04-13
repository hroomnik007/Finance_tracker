import { useSettingsContext } from '../context/SettingsContext'

export function useFormatters() {
  const { settings } = useSettingsContext()

  const formatAmount = (amount: number): string => {
    try {
      return new Intl.NumberFormat('sk-SK', {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${amount.toFixed(2)} ${settings.currency}`
    }
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return ''
    try {
      // Append time to avoid UTC timezone shifting
      const d = new Date(dateStr + 'T00:00:00')
      const day   = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year  = d.getFullYear()
      switch (settings.dateFormat) {
        case 'YYYY-MM-DD': return `${year}-${month}-${day}`
        case 'MM/DD/YYYY': return `${month}/${day}/${year}`
        default:           return `${day}.${month}.${year}` // DD.MM.YYYY
      }
    } catch {
      return dateStr
    }
  }

  return { formatAmount, formatDate }
}
