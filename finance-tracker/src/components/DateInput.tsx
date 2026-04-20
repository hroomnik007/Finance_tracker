interface DateInputProps {
  value: string // always YYYY-MM-DD
  onChange: (value: string) => void
}

export function DateInput({ value, onChange }: DateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => { if (e.target.value) onChange(e.target.value) }}
      className="date-input-styled"
      style={{
        width: '100%',
        height: '48px',
        padding: '0 14px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid #4C3A8A',
        borderRadius: '14px',
        color: '#E2D9F3',
        fontSize: '15px',
        fontFamily: 'inherit',
        outline: 'none',
        colorScheme: 'dark',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#7C3AED' }}
      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#4C3A8A' }}
    />
  )
}
