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
      <AuthCard eyebrow="Dispatched" title="Check the post">
        <p className="text-chalk/80 leading-relaxed mb-6">
          If an account exists for{' '}
          <span className="text-paper font-medium">{email}</span>, a
          reset link is already on its way. The link is good for{' '}
          <span className="font-mono text-paper">30 minutes</span>.
        </p>
        <Link to="/login" className="parley-link text-sm">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow="Recover — 01"
      title="Forgot password"
      subtitle="Tell us where to send the reset link."
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
        {error && (
          <div
            className="text-sm text-rust mb-4 font-mono border-l-2 border-rust pl-3 py-1"
            role="alert"
          >
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Sending…' : 'Send reset link →'}
        </button>
      </form>
      <p className="mt-8 pt-6 border-t border-hairline text-sm text-mist">
        <Link className="parley-link" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
