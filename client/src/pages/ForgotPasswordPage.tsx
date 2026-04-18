import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email },
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your inbox">
        <p className="text-sm text-gray-600 mb-4">
          If an account exists for <span className="font-medium">{email}</span>, a
          password reset link has been sent. The link is valid for 30 minutes.
        </p>
        <Link to="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Forgot password" subtitle="We'll email you a reset link.">
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
        {error && (
          <div className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Sending…' : 'Send reset link'}
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
