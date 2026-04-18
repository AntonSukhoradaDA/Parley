import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogoMark } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function LegalPage({
  eyebrow,
  title,
  lastUpdated,
  children,
}: {
  eyebrow: string
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col bg-ink text-bone">
      <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-hairline">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <LogoMark size={22} className="text-paper" />
          <span className="font-display italic text-paper text-xl leading-none">Parley</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link
            to="/"
            className="text-[13px] text-bone hover:text-paper px-3 py-1.5 transition-colors"
          >
            ← {t('nav.home')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-2xl mx-auto">
          <span className="eyebrow text-accent/80">{eyebrow}</span>
          <h1 className="mt-4 text-paper text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
            {title}
          </h1>
          <div className="mt-3 eyebrow">Last updated · {lastUpdated}</div>
          <div className="mt-10 legal-prose">{children}</div>
        </div>
      </main>

      <footer className="border-t border-hairline px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-mist font-mono">
        <span>{t('landing.footer.copyright')}</span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-chalk transition-colors">
            {t('landing.footer.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-chalk transition-colors">
            {t('landing.footer.terms')}
          </Link>
        </span>
      </footer>
    </div>
  )
}
