import { useSettingsContext } from '../context/SettingsContext'

export function useFormatters() {
  const { settings } = useSettingsContext()

  const formatAmount = (amount: number): string => {
    try {
      const formatted = new Intl.NumberFormat('sk-SK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
      // Map currency codes to display symbols
      const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CZK: 'Kč' }
      const symbol = symbols[settings.currency] ?? settings.currency
      // Use non-breaking spaces throughout to prevent line breaks
      return formatted.replace(/[\s\u202F]/g, '\u00A0') + '\u00A0' + symbol
    } catch {
      return `${amount.toFixed(2)}\u00A0${settings.currency}`
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
