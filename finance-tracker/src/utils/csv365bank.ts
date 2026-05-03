export interface Parsed365BankRow {
  date: string        // ISO: YYYY-MM-DD
  description: string
  amount: number      // negative = expense, positive = income
  currency: string
  balance: number
  category: string
}

export function parse365BankCSV(csvText: string): Parsed365BankRow[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map(line => {
    const cols = line.split(';')
    const [day, month, year] = (cols[0] ?? '').split('.')
    const date = `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`
    const amount = parseFloat((cols[2] ?? '0').replace(',', '.'))
    const balance = parseFloat((cols[4] ?? '0').replace(',', '.'))
    return {
      date,
      description: cols[1]?.trim() ?? '',
      amount,
      currency: cols[3]?.trim() ?? 'EUR',
      balance,
      category: cols[5]?.trim() ?? '',
    }
  }).filter(r => r.date.length === 10 && !isNaN(r.amount))
}
