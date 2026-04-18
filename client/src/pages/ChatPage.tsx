import { useAuthStore } from '@/store/auth'
import { logout } from '@/lib/auth'

export function ChatPage() {
  const user = useAuthStore((s) => s.user)
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-xl font-bold text-gray-800">Parley</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            Signed in as <span className="font-medium">{user?.username}</span>
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center text-gray-500">
        Chat UI coming in Phase 3.
      </main>
    </div>
  )
}
