import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { register } from '@/lib/auth'
import { ApiError } from '@/lib/api'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      await register({ email, username, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      eyebrow="Begin — 01"
      title="Open an account"
      subtitle="Three pieces of paper. Then the room is yours."
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
        <FormField label="Username" hint="3–32 chars · a–z, 0–9, . _ -">
          <input
            type="text"
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_.\-]+"
            placeholder="how others will know you"
            required
          />
        </FormField>
        <FormField label="Password" hint="8 or more">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            placeholder="something you'll remember"
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
          {submitting ? 'Opening…' : 'Open account →'}
        </button>
      </form>
      <p className="mt-8 pt-6 border-t border-hairline text-sm text-mist">
        Already aboard?{' '}
        <Link className="parley-link" to="/login">
          Sign in instead
        </Link>
      </p>
    </AuthCard>
  )
}
