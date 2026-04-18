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
    <AuthCard title="Sign in" subtitle="Welcome back">
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            required
          />
        </FormField>
        {error && (
          <div className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="flex flex-col items-center gap-2 mt-4 text-sm text-gray-500">
        <Link className="text-blue-600 hover:underline" to="/forgot-password">
          Forgot password?
        </Link>
        <span>
          New here?{' '}
          <Link className="text-blue-600 hover:underline" to="/register">
            Create an account
          </Link>
        </span>
      </div>
    </AuthCard>
  )
}
