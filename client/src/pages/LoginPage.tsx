import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { login } from '@/lib/auth'
import { ApiError } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      eyebrow="Resume — 01"
      title="Sign in"
      subtitle="Pick up the conversation where you left it."
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@somewhere.tld"
            required
          />
        </FormField>
        <FormField label="Password">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </FormField>
        {error && (
          <div
            className="text-sm text-rust mb-4 font-mono border-l-2 border-rust pl-3 py-1"
            role="alert"
          >
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Signing in…' : 'Continue →'}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-hairline flex flex-col gap-3 text-sm text-mist">
        <Link className="parley-link self-start" to="/forgot-password">
          Forgot password?
        </Link>
        <span>
          New to Parley?{' '}
          <Link className="parley-link" to="/register">
            Open an account
          </Link>
        </span>
      </div>
    </AuthCard>
  )
}
