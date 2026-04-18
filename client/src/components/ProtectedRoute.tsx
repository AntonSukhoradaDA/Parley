import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Logo } from './Logo'

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink text-mist">
      <div className="flex flex-col items-center gap-3">
        <Logo size="lg" />
        <span className="eyebrow">opening the room…</span>
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
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
