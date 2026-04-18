// Two overlapping speech bubbles — two voices in dialogue. A parley.
// Outlined bubble inherits currentColor; filled bubble uses the accent token.

export function LogoMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Filled bubble — bottom-right, accent */}
      <path
        d="M8 10 h12 a2.5 2.5 0 0 1 2.5 2.5 v5 a2.5 2.5 0 0 1 -2.5 2.5 h-7.5 l-2.8 2.2 a0.4 0.4 0 0 1 -0.65 -0.31 v-1.89 h-1.05 a2.5 2.5 0 0 1 -2.5 -2.5 v-5 a2.5 2.5 0 0 1 2.5 -2.5 z"
        fill="var(--color-accent)"
      />
      {/* Outlined bubble — top-left, overlapping */}
      <path
        d="M4 2 h12 a2.5 2.5 0 0 1 2.5 2.5 v5 a2.5 2.5 0 0 1 -2.5 2.5 h-7.5 l-2.8 2.2 a0.4 0.4 0 0 1 -0.65 -0.31 v-1.89 h-1.05 a2.5 2.5 0 0 1 -2.5 -2.5 v-5 a2.5 2.5 0 0 1 2.5 -2.5 z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="var(--color-ink)"
      />
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
  const wordSize = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'
  const markSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} className="text-paper" />
      <span className={`font-display italic text-paper leading-none ${wordSize}`}>Parley</span>
    </span>
  )
}
