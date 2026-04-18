import { useEffect, type ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = 'max-w-md',
  variant = 'center',
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  width?: string
  variant?: 'center' | 'drawer'
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={
        'fixed inset-0 z-50 bg-ink/72 backdrop-blur-[3px] animate-fade ' +
        (isDrawer ? 'flex justify-end' : 'flex items-center justify-center p-4')
      }
      onClick={onClose}
    >
      <div
        className={
          (isDrawer
            ? `h-full w-full ${width} bg-vellum border-l border-hairline-strong animate-drawer flex flex-col`
            : `w-full ${width} bg-vellum border border-hairline-strong rounded-[6px] shadow-2xl shadow-black/60 max-h-[88vh] flex flex-col animate-modal`)
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-hairline">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1.5 text-accent/80">{eyebrow}</div>}
            <h3 className="text-paper text-xl font-medium tracking-tight leading-tight truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="text-mist hover:text-paper text-2xl leading-none px-1 -mt-0.5 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
      </div>
    </div>
  )
}
