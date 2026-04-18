// Two opposing chevrons meeting at a center point — the geometry of a parley:
// two parties facing each other across a table.

export function LogoMark({
  size = 22,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="5"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M7 6.5L11 12L7 17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 6.5L13 12L17 17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function Logo({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const wordSize =
    size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'
  const markSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} className="text-accent" />
      <span
        className={`font-display italic text-paper leading-none ${wordSize}`}
      >
        Parley
      </span>
    </span>
  )
}
