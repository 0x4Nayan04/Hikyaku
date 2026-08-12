import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Lock, Mail } from 'lucide-react'
import { ApiError, getBootstrapStatus, login } from '@/api/client'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import {
  LOGIN_FAILED_RECOVERY,
  LOGIN_PASSWORD_RESET_HINT,
  resolveLoginBanner,
  shouldShowBootstrapSetupLink,
  type LoginBannerKind,
} from '@/lib/auth-first-run'
import { getPostLoginPath } from '@/lib/auth-redirect'
import { APP_NAME } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

type LoginLocationState = {
  message?: string
  banner?: LoginBannerKind
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading, refresh } = useSession()
  const locationState = location.state as LoginLocationState | null
  const banner =
    locationState?.message != null
      ? resolveLoginBanner(locationState.banner, locationState.message)
      : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bootstrapAvailable, setBootstrapAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!loading && session) {
      navigate(getPostLoginPath(location.state, session.user), { replace: true })
    }
  }, [loading, session, navigate, location])

  useEffect(() => {
    let cancelled = false
    getBootstrapStatus()
      .then((status) => {
        if (!cancelled) {
          setBootstrapAvailable(status.available)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBootstrapAvailable(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setShowRecovery(false)
    setSubmitting(true)

    try {
      const { user } = await login({ email, password })
      await refresh()
      navigate(getPostLoginPath(location.state, user), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Try again.')
      setShowRecovery(true)
    } finally {
      setSubmitting(false)
    }
  }

  const showBootstrapLink = shouldShowBootstrapSetupLink(bootstrapAvailable)

  return (
    <AuthLayout
      variant="split"
      eyebrow="Sign in"
      title="Sign in"
      description={`Sign in to your ${APP_NAME} workspace or platform admin account.`}
      sidePanel={
        <div className="flex flex-col gap-6 h-full">
          <div className="flex flex-col gap-6 flex-1">
            <div>
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                Delivery console
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">
                Manage endpoints, send events, and inspect delivery attempts for your tenant.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              {(
                [
                  'Delivery metrics and recent activity',
                  'Automatic retries with exponential backoff',
                  'Event payloads and attempt history',
                  'API keys and endpoint settings',
                ] as const
              ).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-strong">
              Need a workspace? Ask the platform admin for an invite.
            </p>
            {showBootstrapLink ? (
              <AuthFooterLink
                prompt="First deploy?"
                linkLabel="Run one-time setup"
                to="/bootstrap"
              />
            ) : null}
          </div>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} aria-describedby="login-status">
        <div id="login-status" className="auth-form-status" aria-live="assertive" aria-atomic="true">
          {banner ? (
            <PageBanner
              variant={banner.variant}
              title={banner.title}
              description={banner.description}
            />
          ) : null}
          {error ? <PageBanner variant="error" title="Sign in failed" description={error} /> : null}
          {showRecovery ? (
            <PageBanner variant="info" title="Next steps" description={LOGIN_FAILED_RECOVERY} />
          ) : null}
          {!banner && !error && !showRecovery ? (
            <p className="auth-form-status__placeholder">Sign-in errors appear here.</p>
          ) : null}
        </div>

        <AuthFormField
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />

        <p className="-mt-1 rounded-none border border-border bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-ink">Need a password reset?</span> {LOGIN_PASSWORD_RESET_HINT}
        </p>

        <button type="submit" disabled={submitting} className="sm-btn sm-btn-primary sm-btn-block">
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </button>
      </form>
    </AuthLayout>
  )
}
