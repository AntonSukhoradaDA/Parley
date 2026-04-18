import type { PresenceStatus } from '@/store/presence'

const SIZES = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
} as const

const COLORS: Record<PresenceStatus, string> = {
  online: 'bg-moss',
  afk: 'bg-yellow-500',
  offline: 'bg-stone',
}

export function PresenceDot({
  status,
  size = 'sm',
  className = '',
}: {
  status: PresenceStatus
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${SIZES[size]} ${COLORS[status]} ${className}`}
      aria-hidden
    />
  )
}
