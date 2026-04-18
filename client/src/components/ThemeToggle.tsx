import type { ComponentType, SVGProps } from 'react'
import { useThemeStore, type Theme } from '@/store/theme'
import { SunIcon, MoonIcon, SystemIcon } from '@/components/icons'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

const OPTIONS: { value: Theme; label: string; Icon: IconComp }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'system', label: 'System', Icon: SystemIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
]

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-[var(--radius-soft)] border border-[var(--color-hairline-strong)] bg-[var(--color-vellum)] p-[2px]"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={[
              'inline-flex h-7 w-7 items-center justify-center rounded-[3px] transition-colors',
              active
                ? 'bg-[var(--color-stone)] text-[var(--color-paper)]'
                : 'text-[var(--color-mist)] hover:text-[var(--color-chalk)]',
            ].join(' ')}
          >
            <Icon width={13} height={13} />
          </button>
        )
      })}
    </div>
  )
}
