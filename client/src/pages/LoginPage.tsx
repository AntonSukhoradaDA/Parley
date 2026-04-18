import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { login } from '@/lib/auth'
import { ApiError } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      navigate('/chats', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      eyebrow={t('auth.login.eyebrow')}
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label={t('auth.login.email')}>
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
        <FormField label={t('auth.login.password')}>
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
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-hairline flex flex-col gap-3 text-sm text-mist">
        <Link className="parley-link self-start" to="/forgot-password">
          {t('auth.login.forgot')}
        </Link>
        <span>
          {t('auth.login.noAccount')}{' '}
          <Link className="parley-link" to="/register">
            {t('auth.login.register')}
          </Link>
        </span>
      </div>
    </AuthCard>
  )
}
