import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LogoMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSwitcher } from './LanguageSwitcher'

interface AuthCardProps {
  title: string
  subtitle?: string
  eyebrow?: string
  epigraph?: { quote: string; attribution: string }
  children: ReactNode
}

const defaultEpigraph = {
  quote:
    '“To parley is to set down arms long enough to find the words; for words, well-placed, outrun any cannon.”',
  attribution: '- Marginalia, Vol. III',
}

export function AuthCard({
  title,
  subtitle,
  eyebrow,
  epigraph = defaultEpigraph,
  children,
}: AuthCardProps) {
  const { t } = useTranslation()
  const resolvedEyebrow = eyebrow ?? t('auth.login.eyebrow')
  return (
    <div className="min-h-screen w-full bg-ink text-bone flex flex-col lg:flex-row">
      {/* Atmospheric panel ─────────────────────────────────── */}
      <aside className="relative grain accent-glow lg:w-[46%] xl:w-[42%] flex flex-col justify-between p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-hairline overflow-hidden">
        <header className="relative z-10 flex items-center justify-between">
          <LogoMark size={22} className="text-accent" />
        </header>

        <div className="relative z-10 my-10 lg:my-0">
          <div className="font-display text-paper leading-[0.85] text-[18vw] lg:text-[14vw] xl:text-[11vw] tracking-tight animate-ink">
            <span className="italic">Parley</span>
            <span className="text-accent align-top text-[0.35em] ml-2">·</span>
          </div>
          <p className="mt-6 max-w-md text-chalk/70 text-base leading-relaxed font-light hidden lg:block animate-fade delay-2">
            {t('landing.hero.tagline')}
          </p>
        </div>

        <footer className="relative z-10 hidden lg:block max-w-md animate-fade delay-3">
          <div className="divider-dotted mb-5" />
          <p className="text-chalk text-base leading-relaxed font-light">{epigraph.quote}</p>
          <p className="eyebrow mt-3">{epigraph.attribution}</p>
        </footer>
      </aside>

      {/* Form panel ────────────────────────────────────────── */}
      <main className="relative flex-1 flex items-center justify-center px-6 py-10 lg:py-16 bg-vellum">
        <div className="absolute top-5 right-5 lg:top-8 lg:right-8 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-9">
            <span className="eyebrow text-accent/80">{resolvedEyebrow}</span>
            <h1 className="text-paper text-3xl lg:text-[34px] mt-3 leading-[1.05] font-medium tracking-tight">
              {title}.
            </h1>
            {subtitle && (
              <p className="mt-3 text-mist text-sm leading-relaxed max-w-xs">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block mb-5">
      <div className="flex items-baseline justify-between mb-1">
        <span className="eyebrow">{label}</span>
        {hint && <span className="text-[10.5px] text-mist font-mono">{hint}</span>}
      </div>
      {children}
      {error && <span className="block text-xs text-rust mt-1.5 font-mono">{error}</span>}
    </label>
  )
}

// Backwards-compatible class exports — keep the same prop names.
export const inputClass = 'parley-input'
export const buttonClass = 'parley-button'
