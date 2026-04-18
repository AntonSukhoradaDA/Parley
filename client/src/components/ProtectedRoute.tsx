import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Loading…
      </div>
    )
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Loading…
      </div>
    )
  }
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
