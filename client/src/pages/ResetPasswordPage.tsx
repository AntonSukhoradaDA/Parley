import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, newPassword: password },
      })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <p className="text-sm text-gray-600">
          You can now sign in with your new password. Redirecting…
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <form onSubmit={onSubmit} noValidate>
        {!params.get('token') && (
          <FormField label="Reset token">
            <input
              type="text"
              className={inputClass}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </FormField>
        )}
        <FormField label="New password">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </FormField>
        <FormField label="Confirm new password">
          <input
            type="password"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </FormField>
        {error && (
          <div className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        <Link className="text-blue-600 hover:underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
