import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { Logo } from './Logo'

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink text-mist">
      <div className="flex flex-col items-center gap-3">
        <Logo size="lg" />
        <span className="eyebrow">{t('common.loading')}</span>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') return <Loading />
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') return <Loading />
  if (status === 'authenticated') return <Navigate to="/chats" replace />
  return <Outlet />
}
