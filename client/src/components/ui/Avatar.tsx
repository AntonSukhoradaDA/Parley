const SIZES = {
  xs: { box: 'w-5 h-5', text: 'text-[10px]' },
  sm: { box: 'w-6 h-6', text: 'text-[10px]' },
  md: { box: 'w-7 h-7', text: 'text-xs' },
  lg: { box: 'w-9 h-9', text: 'text-sm' },
} as const

export type AvatarSize = keyof typeof SIZES

export function Avatar({
  name,
  size = 'sm',
  className = '',
}: {
  name: string
  size?: AvatarSize
  className?: string
}) {
  const sz = SIZES[size]
  return (
    <span
      className={
        `${sz.box} ${sz.text} rounded-full bg-slate border border-hairline ` +
        `flex items-center justify-center font-mono text-mist uppercase shrink-0 ${className}`
      }
      aria-hidden
    >
      {name.charAt(0) || '·'}
    </span>
  )
}
