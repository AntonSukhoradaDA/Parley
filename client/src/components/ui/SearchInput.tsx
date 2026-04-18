import { SearchIcon } from '@/components/icons'

export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-mist pointer-events-none"
        aria-hidden
      >
        <SearchIcon width={14} height={14} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-slate/60 border border-hairline text-paper placeholder:text-mist text-[13px] rounded-[var(--radius-soft)] pl-9 pr-3 py-2 outline-none focus:border-accent/60 transition-colors"
      />
    </div>
  )
}
