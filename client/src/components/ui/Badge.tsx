// Small accent count badge used for unread indicators.
export function Badge({
  count,
  cap = 99,
  className = '',
}: {
  count: number
  cap?: number
  className?: string
}) {
  if (count <= 0) return null
  const label = count > cap ? `${cap}+` : String(count)
  return (
    <span
      className={
        `min-w-[18px] h-[18px] px-1 flex items-center justify-center ` +
        `rounded-full bg-accent text-ink text-[10px] font-mono font-bold ${className}`
      }
    >
      {label}
    </span>
  )
}
