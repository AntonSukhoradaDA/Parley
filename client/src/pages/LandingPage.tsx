import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { LogoMark } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function LandingPage() {
  const status = useAuthStore((s) => s.status)
  const { t } = useTranslation()
  if (status === 'authenticated') return <Navigate to="/chats" replace />

  return (
    <div className="min-h-screen flex flex-col bg-ink text-bone relative">
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 border-b border-hairline/60 bg-ink/40 backdrop-blur-sm">
        <Link to="/" className="inline-flex items-center gap-2 sm:gap-2.5 shrink-0">
          <LogoMark size={22} className="text-paper" />
          <span className="font-display italic text-paper text-lg sm:text-xl leading-none">
            Parley
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/login"
              className="text-[13px] text-bone hover:text-paper px-2 sm:px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              {t('landing.header.signIn')}
            </Link>
            <Link
              to="/register"
              className="parley-button w-auto! px-3! sm:px-4! py-1.5! text-[13px]! whitespace-nowrap"
            >
              {t('landing.header.register')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative grain accent-glow min-h-svh flex items-center justify-center px-6 pt-24 pb-12 overflow-hidden">
        <div className="relative z-10 max-w-3xl text-center animate-rise">
          <span className="eyebrow text-accent/80">{t('landing.hero.eyebrow')}</span>
          <h1 className="mt-6 font-display text-paper text-[13vw] lg:text-[120px] leading-[0.9] tracking-tight">
            <span className="italic">Parley</span>
            <span className="text-accent align-top text-[0.35em] ml-2">·</span>
          </h1>
          <p className="mt-8 text-chalk/80 text-lg lg:text-xl leading-relaxed max-w-xl mx-auto font-light">
            {t('landing.hero.tagline')}
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/register" className="parley-button w-auto! px-6!">
              {t('landing.hero.createAccount')}
            </Link>
            <Link to="/login" className="parley-button-ghost">
              {t('landing.hero.signIn')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-hairline bg-vellum">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="mb-12 max-w-xl">
            <span className="eyebrow text-accent/80">{t('landing.features.eyebrow')}</span>
            <h2 className="mt-3 text-paper text-3xl lg:text-4xl font-medium tracking-tight leading-tight">
              {t('landing.features.heading_line1')}
              <br />
              {t('landing.features.heading_line2')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            <Feature
              eyebrow={t('landing.features.rooms.eyebrow')}
              title={t('landing.features.rooms.title')}
              body={t('landing.features.rooms.body')}
            />
            <Feature
              eyebrow={t('landing.features.direct.eyebrow')}
              title={t('landing.features.direct.title')}
              body={t('landing.features.direct.body')}
            />
            <Feature
              eyebrow={t('landing.features.presence.eyebrow')}
              title={t('landing.features.presence.title')}
              body={t('landing.features.presence.body')}
            />
            <Feature
              eyebrow={t('landing.features.attachments.eyebrow')}
              title={t('landing.features.attachments.title')}
              body={t('landing.features.attachments.body')}
            />
            <Feature
              eyebrow={t('landing.features.history.eyebrow')}
              title={t('landing.features.history.title')}
              body={t('landing.features.history.body')}
            />
            <Feature
              eyebrow={t('landing.features.moderation.eyebrow')}
              title={t('landing.features.moderation.title')}
              body={t('landing.features.moderation.body')}
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-hairline">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-24 text-center">
          <h3 className="font-display italic text-paper text-4xl lg:text-5xl leading-tight tracking-tight">
            {t('landing.cta.title')}
          </h3>
          <p className="mt-5 text-mist max-w-md mx-auto leading-relaxed">{t('landing.cta.body')}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/register" className="parley-button w-auto! px-6!">
              {t('landing.cta.start')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline px-4 sm:px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-mist font-mono">
        <span className="text-center sm:text-left">{t('landing.footer.copyright')}</span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-chalk transition-colors">
            {t('landing.footer.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-chalk transition-colors">
            {t('landing.footer.terms')}
          </Link>
        </span>
        <div className="flex sm:hidden items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </footer>
    </div>
  )
}

function Feature({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-hairline bg-ink/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-ink/70 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(400px circle at var(--x,50%) var(--y,50%), color-mix(in oklab, var(--color-accent) 14%, transparent), transparent 60%)',
        }}
      />
      <span
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-0.5 bg-accent scale-y-0 origin-top transition-transform duration-300 group-hover:scale-y-100"
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="eyebrow text-accent/70">{eyebrow}</div>
          <span
            aria-hidden
            className="text-mist text-sm font-mono translate-x-0 group-hover:translate-x-0.5 group-hover:text-accent transition-all duration-300"
          >
            →
          </span>
        </div>
        <h4 className="mt-2 text-paper text-lg font-medium tracking-tight">{title}</h4>
        <p className="mt-2 text-bone/80 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
