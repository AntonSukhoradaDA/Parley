import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard, FormField, buttonClass, inputClass } from '@/components/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
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
      <AuthCard eyebrow={t('auth.forgot.eyebrow')} title={t('auth.forgot.title')}>
        <p className="text-chalk/80 leading-relaxed mb-6">{t('auth.forgot.success')}</p>
        <Link to="/login" className="parley-link text-sm">
          {t('auth.forgot.backToLogin')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow={t('auth.forgot.eyebrow')}
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label={t('auth.forgot.email')}>
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
          {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
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
