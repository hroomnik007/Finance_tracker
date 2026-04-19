import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { X, Upload, Check } from 'lucide-react'
import { createTransaction } from '../api/transactions'

interface CsvRow {
  Date?: string
  Description?: string
  Amount?: string
  Currency?: string
  State?: string
  // Alternate column names
  'Started Date'?: string
  'Completed Date'?: string
  [key: string]: string | undefined
}

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

function parseRevolutDate(raw: string): string {
  // Revolut formats: "2024-01-15 12:34:56" or "2024-01-15"
  return raw.split(' ')[0].split('T')[0]
}

export function CsvImportModal({ open, onClose, filterType }: CsvImportModalProps) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function handleFile(file: File) {
    setError(null)
    setImportedCount(null)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: ImportRow[] = result.data
          .filter(row => {
            const state = row.State ?? row['State'] ?? 'COMPLETED'
            return state === 'COMPLETED' && (row.Amount || row.amount) && (row.Date || row['Started Date'] || row['Completed Date'])
          })
          .map(row => {
            const rawAmount = row.Amount ?? row.amount ?? '0'
            const amount = parseFloat(rawAmount.replace(',', '.').replace(/\s/g, ''))
            const rawDate = row.Date ?? row['Started Date'] ?? row['Completed Date'] ?? ''
            const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense'
            return {
              date: parseRevolutDate(rawDate),
              description: row.Description ?? row.description ?? '',
              amount: Math.abs(amount),
              type,
              selected: filterType ? type === filterType : true,
            }
          })
          .filter(r => r.amount > 0 && r.date.match(/^\d{4}-\d{2}-\d{2}$/))

        if (parsed.length === 0) {
          setError('Žiadne COMPLETED záznamy s platnou sumou nájdené v súbore.')
        } else {
          setRows(parsed)
        }
      },
      error: () => setError('Chyba pri čítaní súboru. Skontrolujte formát CSV.'),
    })
  }

  async function handleImport() {
    const selected = rows.filter(r => r.selected)
    if (selected.length === 0) return
    setImporting(true)
    try {
      for (const row of selected) {
        await createTransaction({
          type: row.type,
          amount: row.amount,
          description: row.description,
          date: row.date,
          isFixed: false,
        })
      }
      setImportedCount(selected.length)
      setRows([])
    } catch {
      setError('Chyba pri importe. Skúste znova.')
    } finally {
      setImporting(false)
    }
  }

  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const selectedCount = rows.filter(r => r.selected).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 560,
        maxHeight: '92vh', background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)', borderRadius: 24,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E2D9F3', paddingTop: 2 }}>
            Import Revolut CSV
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9D84D4', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {importedCount !== null ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#34D399', marginBottom: 8 }}>
                Importovaných {importedCount} transakcií
              </p>
              <p style={{ fontSize: 13, color: '#9D84D4', marginBottom: 24 }}>
                Transakcie boli uložené do vašej databázy.
              </p>
              <button
                onClick={onClose}
                style={{
                  height: 48, padding: '0 32px',
                  background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  border: 'none', borderRadius: 14, color: 'white', fontSize: 15,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Zatvoriť
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div>
              <p style={{ fontSize: 13, color: '#9D84D4', marginBottom: 20, lineHeight: 1.7 }}>
                Nahraj CSV export z Revolut aplikácie (<strong style={{ color: '#A78BFA' }}>Statements → Export</strong>). Importujú sa iba záznamy so stavom <strong style={{ color: '#A78BFA' }}>COMPLETED</strong>.
              </p>
              <div
                style={{
                  border: '2px dashed #4C3A8A', borderRadius: 16, padding: '36px 24px',
                  textAlign: 'center', cursor: 'pointer',
                  background: 'rgba(124,58,237,0.03)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED' }}
                onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#4C3A8A' }}
                onDrop={e => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = '#4C3A8A'
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
              >
                <Upload size={32} style={{ color: '#7C3AED', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: '#E2D9F3', marginBottom: 4 }}>Presuň CSV súbor sem</p>
                <p style={{ fontSize: 13, color: '#9D84D4' }}>alebo klikni pre výber súboru</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                />
              </div>
              {error && <p style={{ color: '#F87171', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#9D84D4' }}>
                  {rows.length} záznamov · <span style={{ color: '#A78BFA' }}>{selectedCount}</span> vybraných
                </p>
                <button
                  onClick={() => setRows(r => r.map(x => ({ ...x, selected: !allSelected })))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', fontSize: 13, fontFamily: 'inherit' }}
                >
                  {allSelected ? 'Odznačiť všetky' : 'Vybrať všetky'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    onClick={() => setRows(r => r.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                      borderRadius: 12, cursor: 'pointer',
                      background: row.selected ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${row.selected ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: row.selected ? '#7C3AED' : 'transparent',
                      border: `2px solid ${row.selected ? '#7C3AED' : '#4C3A8A'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}>
                      {row.selected && <Check size={12} color="white" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{row.type === 'income' ? '💰' : '💸'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#E2D9F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description || '—'}
                      </p>
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

        {/* Footer buttons */}
        {rows.length > 0 && importedCount === null && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 12, background: 'rgba(13,10,26,0.3)', flexShrink: 0,
          }}>
            <button
              onClick={() => { setRows([]); setError(null) }}
              style={{
                flex: 1, height: 48, background: 'transparent',
                border: '1px solid #4C3A8A', borderRadius: 14,
                color: '#9D84D4', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Zrušiť
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              style={{
                flex: 2, height: 48,
                background: selectedCount > 0 ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : '#32265A',
                border: 'none', borderRadius: 14, color: 'white', fontSize: 15, fontWeight: 600,
                cursor: selectedCount > 0 && !importing ? 'pointer' : 'default',
                opacity: importing ? 0.7 : 1, fontFamily: 'inherit',
              }}
            >
              {importing ? 'Importujem...' : `Importovať (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
