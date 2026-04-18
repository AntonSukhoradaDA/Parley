import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type LangCode } from '@/i18n'
import { ChevronDownIcon, GlobeIcon } from '@/components/icons'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(code: LangCode) {
    void i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-soft)] border border-hairline-strong text-[12px] font-mono text-bone hover:text-paper hover:border-accent/50 transition-colors"
        title={t('lang.label')}
        aria-label={t('lang.label')}
      >
        <GlobeIcon width={12} height={12} />
        {current.short}
        <ChevronDownIcon width={9} height={9} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-vellum border border-hairline-strong rounded-[var(--radius-soft)] shadow-2xl shadow-black/50 z-40 animate-modal py-1.5">
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = l.code === current.code
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => pick(l.code)}
                className={
                  'w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center justify-between ' +
                  (active ? 'text-paper bg-slate' : 'text-bone hover:bg-slate hover:text-paper')
                }
              >
                <span>{l.label}</span>
                <span className="font-mono text-[10px] text-mist">{l.short}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
