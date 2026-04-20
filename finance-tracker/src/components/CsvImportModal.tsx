import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { X, Upload, Check, ChevronDown } from 'lucide-react'
import { createTransaction } from '../api/transactions'

interface ImportRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  selected: boolean
}

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  filterType?: 'income' | 'expense'
}

type BankFormat = 'revolut' | 'tatra' | 'slsp' | 'mbank' | 'custom'

const BANK_FORMATS: { id: BankFormat; label: string; emoji: string }[] = [
  { id: 'revolut', label: 'Revolut', emoji: '🌀' },
  { id: 'tatra',   label: 'Tatra banka', emoji: '🏦' },
  { id: 'slsp',    label: 'Slovenská sporiteľňa', emoji: '🏦' },
  { id: 'mbank',   label: 'mBank', emoji: '🏦' },
  { id: 'custom',  label: 'Vlastný CSV', emoji: '📋' },
]

function parseDate(raw: string): string {
  if (!raw) return ''
  // DD.MM.YYYY
  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  // YYYY-MM-DD or YYYY-MM-DD HH:mm
  return raw.split(' ')[0].split('T')[0]
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  return parseFloat(raw.replace(/\s/g,'').replace(',','.').replace(/[^\d.\-]/g,'')) || 0
}

type CsvRow = Record<string, string | undefined>

function parseRevolut(rows: CsvRow[]): ImportRow[] {
  return rows
    .filter(r => {
      const state = r['State'] ?? 'COMPLETED'
      return state === 'COMPLETED'
    })
    .map(r => {
      const rawDate = r['Date'] ?? r['Started Date'] ?? r['Completed Date'] ?? ''
      const rawAmount = r['Amount'] ?? r['amount'] ?? '0'
      const amount = parseAmount(rawAmount)
      return {
        date: parseDate(rawDate),
        description: r['Description'] ?? r['description'] ?? '',
        amount: Math.abs(amount),
        type: (amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
        selected: true,
      }
    })
    .filter(r => r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

function parseTatra(rows: CsvRow[]): ImportRow[] {
  // Typical Tatra banka columns: Dátum, Popis transakcie / Informácie o príjemcovi, Suma v EUR
  return rows
    .map(r => {
      const rawDate = r['Dátum'] ?? r['Datum'] ?? r['Date'] ?? ''
      const rawAmount = r['Suma v EUR'] ?? r['Suma'] ?? r['Amount'] ?? r['Kredit'] ?? r['Debet'] ?? '0'
      const desc = r['Popis transakcie'] ?? r['Popis'] ?? r['Description'] ?? r['Informácie o príjemcovi'] ?? ''
      const amount = parseAmount(rawAmount)
      return {
        date: parseDate(rawDate),
        description: desc,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' as const : 'expense' as const,
        selected: true,
      }
    })
    .filter(r => r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

function parseSLSP(rows: CsvRow[]): ImportRow[] {
  // Typical SLSP columns: Dátum, Opis, Suma, Typ
  return rows
    .map(r => {
      const rawDate = r['Dátum'] ?? r['Datum'] ?? r['Date'] ?? ''
      const rawAmount = r['Suma'] ?? r['Amount'] ?? r['Kredit'] ?? r['Debet'] ?? '0'
      const desc = r['Opis'] ?? r['Popis'] ?? r['Description'] ?? r['Referencia'] ?? ''
      const amount = parseAmount(rawAmount)
      return {
        date: parseDate(rawDate),
        description: desc,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' as const : 'expense' as const,
        selected: true,
      }
    })
    .filter(r => r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

function parseMBank(rows: CsvRow[]): ImportRow[] {
  // mBank SK: #Data operacji, #Opis operacji, #Kwota, or Dátum, Opis, Suma
  return rows
    .map(r => {
      const rawDate = r['#Data operacji'] ?? r['Dátum'] ?? r['Date'] ?? ''
      const rawAmount = r['#Kwota'] ?? r['Suma'] ?? r['Amount'] ?? '0'
      const desc = r['#Opis operacji'] ?? r['Opis'] ?? r['Description'] ?? ''
      const amount = parseAmount(rawAmount)
      return {
        date: parseDate(rawDate),
        description: desc,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' as const : 'expense' as const,
        selected: true,
      }
    })
    .filter(r => r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
}

export function CsvImportModal({ open, onClose, filterType }: CsvImportModalProps) {
  const [format, setFormat] = useState<BankFormat>('revolut')
  const [showFormatPicker, setShowFormatPicker] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Custom CSV mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawCsvRows, setRawCsvRows] = useState<CsvRow[]>([])
  const [customMapping, setCustomMapping] = useState({ date: '', description: '', amount: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function applyFilter(parsed: ImportRow[]): ImportRow[] {
    return parsed.map(r => ({ ...r, selected: filterType ? r.type === filterType : true }))
  }

  function handleFile(file: File) {
    setError(null)
    setImportedCount(null)
    setRows([])
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: format === 'mbank' ? ';' : undefined,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        if (format === 'custom') {
          setCsvHeaders(headers)
          setRawCsvRows(result.data)
          setCustomMapping({ date: headers[0] ?? '', description: headers[1] ?? '', amount: headers[2] ?? '' })
          return
        }
        let parsed: ImportRow[] = []
        switch (format) {
          case 'revolut': parsed = parseRevolut(result.data); break
          case 'tatra':   parsed = parseTatra(result.data); break
          case 'slsp':    parsed = parseSLSP(result.data); break
          case 'mbank':   parsed = parseMBank(result.data); break
        }
        if (parsed.length === 0) {
          setError('Žiadne platné záznamy neboli nájdené. Skontrolujte formát súboru.')
        } else {
          setRows(applyFilter(parsed))
        }
      },
      error: () => setError('Chyba pri čítaní súboru.'),
    })
  }

  function applyCustomMapping() {
    if (!customMapping.date || !customMapping.amount) {
      setError('Vyberte stĺpec pre dátum a sumu.')
      return
    }
    const parsed: ImportRow[] = rawCsvRows
      .map(r => {
        const rawDate = r[customMapping.date] ?? ''
        const rawAmount = r[customMapping.amount] ?? '0'
        const amount = parseAmount(rawAmount)
        return {
          date: parseDate(rawDate),
          description: customMapping.description ? (r[customMapping.description] ?? '') : '',
          amount: Math.abs(amount),
          type: amount >= 0 ? 'income' as const : 'expense' as const,
          selected: true,
        }
      })
      .filter(r => r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    if (parsed.length === 0) {
      setError('Žiadne platné záznamy. Skontrolujte mapovanie stĺpcov.')
    } else {
      setError(null)
      setRows(applyFilter(parsed))
      setCsvHeaders([])
    }
  }

  async function handleImport() {
    const selected = rows.filter(r => r.selected)
    if (selected.length === 0) return
    setImporting(true)
    try {
      for (const row of selected) {
        await createTransaction({ type: row.type, amount: row.amount, description: row.description, date: row.date, isFixed: false })
      }
      setImportedCount(selected.length)
      setRows([])
    } catch {
      setError('Chyba pri importe. Skúste znova.')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setRows([]); setError(null); setCsvHeaders([]); setRawCsvRows([])
  }

  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const selectedCount = rows.filter(r => r.selected).length
  const currentBank = BANK_FORMATS.find(b => b.id === format)!

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '92vh', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E2D9F3' }}>Import CSV</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9D84D4', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {importedCount !== null ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#34D399', marginBottom: 8 }}>Importovaných {importedCount} transakcií</p>
              <button onClick={onClose} style={{ height: 48, padding: '0 32px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 14, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }}>Zatvoriť</button>
            </div>
          ) : rows.length === 0 && csvHeaders.length === 0 ? (
            <div>
              {/* Format picker */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <button
                  onClick={() => setShowFormatPicker(p => !p)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid #4C3A8A', borderRadius: 12, cursor: 'pointer', color: '#E2D9F3', fontSize: 14, fontFamily: 'inherit' }}
                >
                  <span>{currentBank.emoji} {currentBank.label}</span>
                  <ChevronDown size={16} color="#9D84D4" />
                </button>
                {showFormatPicker && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#2A1F4A', border: '1px solid #4C3A8A', borderRadius: 12, overflow: 'hidden', zIndex: 10 }}>
                    {BANK_FORMATS.map(b => (
                      <button key={b.id} onClick={() => { setFormat(b.id); setShowFormatPicker(false) }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: b.id === format ? 'rgba(124,58,237,0.2)' : 'transparent', border: 'none', color: b.id === format ? '#A78BFA' : '#E2D9F3', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        {b.emoji} {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{ border: '2px dashed #4C3A8A', borderRadius: 16, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(124,58,237,0.03)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED' }}
                onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#4C3A8A' }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#4C3A8A'; const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              >
                <Upload size={32} style={{ color: '#7C3AED', margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: '#E2D9F3', marginBottom: 4 }}>Presuň CSV sem</p>
                <p style={{ fontSize: 13, color: '#9D84D4' }}>alebo klikni pre výber súboru</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              </div>
              {error && <p style={{ color: '#F87171', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>}
            </div>
          ) : csvHeaders.length > 0 ? (
            // Custom column mapping
            <div>
              <p style={{ fontSize: 13, color: '#9D84D4', marginBottom: 16 }}>Namapuj stĺpce z CSV súboru:</p>
              {(['date', 'description', 'amount'] as const).map(field => (
                <div key={field} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#9D84D4', display: 'block', marginBottom: 4 }}>
                    {field === 'date' ? 'Dátum *' : field === 'description' ? 'Popis' : 'Suma *'}
                  </label>
                  <select
                    value={customMapping[field]}
                    onChange={e => setCustomMapping(m => ({ ...m, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid #4C3A8A', borderRadius: 10, color: '#E2D9F3', fontSize: 13, fontFamily: 'inherit' }}
                  >
                    <option value="">— nezvolený —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              {error && <p style={{ color: '#F87171', fontSize: 13, marginTop: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={reset} style={{ flex: 1, height: 44, background: 'transparent', border: '1px solid #4C3A8A', borderRadius: 12, color: '#9D84D4', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Späť</button>
                <button onClick={applyCustomMapping} style={{ flex: 2, height: 44, background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Pokračovať</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#9D84D4' }}>{rows.length} záznamov · <span style={{ color: '#A78BFA' }}>{selectedCount}</span> vybraných</p>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, selected: !allSelected })))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', fontSize: 13, fontFamily: 'inherit' }}>
                  {allSelected ? 'Odznačiť' : 'Vybrať všetky'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((row, i) => (
                  <div key={i} onClick={() => setRows(r => r.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: row.selected ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${row.selected ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: row.selected ? '#7C3AED' : 'transparent', border: `2px solid ${row.selected ? '#7C3AED' : '#4C3A8A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {row.selected && <Check size={12} color="white" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{row.type === 'income' ? '💰' : '💸'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#E2D9F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</p>
                      <p style={{ fontSize: 11, color: '#9D84D4', marginTop: 1 }}>{row.date}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.type === 'income' ? '#34D399' : '#F87171', flexShrink: 0 }}>
                      {row.type === 'income' ? '+' : '-'}{row.amount.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
              {error && <p style={{ color: '#F87171', fontSize: 13, marginTop: 12 }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && importedCount === null && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
            <button onClick={reset} style={{ flex: 1, height: 48, background: 'transparent', border: '1px solid #4C3A8A', borderRadius: 14, color: '#9D84D4', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Zrušiť</button>
            <button onClick={handleImport} disabled={selectedCount === 0 || importing}
              style={{ flex: 2, height: 48, background: selectedCount > 0 ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : '#32265A', border: 'none', borderRadius: 14, color: 'white', fontSize: 15, fontWeight: 600, cursor: selectedCount > 0 && !importing ? 'pointer' : 'default', opacity: importing ? 0.7 : 1, fontFamily: 'inherit' }}>
              {importing ? 'Importujem...' : `Importovať (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
