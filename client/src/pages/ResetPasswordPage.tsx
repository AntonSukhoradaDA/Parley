import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      <AuthCard eyebrow={t('auth.reset.eyebrow')} title={t('auth.reset.title')}>
        <p className="text-chalk/80 leading-relaxed">{t('auth.reset.success')}</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow={t('auth.reset.eyebrow')}
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
    >
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
        <FormField label={t('auth.reset.password')} hint="8+">
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
        <FormField label={t('auth.reset.confirm')}>
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
          <div
            className="text-sm text-rust mb-4 font-mono border-l-2 border-rust pl-3 py-1"
            role="alert"
          >
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </button>
      </form>
      <p className="mt-8 pt-6 border-t border-hairline text-sm text-mist">
        <Link className="parley-link" to="/login">
          {t('auth.forgot.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  )
}
