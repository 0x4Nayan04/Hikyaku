import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Lock, Mail } from 'lucide-react'
import { ApiError, login } from '@/api/client'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getPostLoginPath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

type LoginLocationState = {
  message?: string
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading, refresh } = useSession()
  const successMessage = (location.state as LoginLocationState | null)?.message
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showForgotHint, setShowForgotHint] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      navigate(getPostLoginPath(location.state, session.user), { replace: true })
    }
  }, [loading, session, navigate, location])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { user } = await login({ email, password })
      await refresh()
      navigate(getPostLoginPath(location.state, user), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleForgotHint = useCallback(() => setShowForgotHint((v) => !v), [])

  return (
    <AuthLayout
      variant="split"
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in to your workspace to manage webhook deliveries."
      sidePanel={
        <div className="flex flex-col gap-6 h-full">
          <div className="flex flex-col gap-6 flex-1">
            <div>
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                A dedicated webhook delivery console for your team
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">
                Monitor, debug, and manage webhook deliveries across all your services from a single
                workspace.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              {([
                'Real-time delivery monitoring and debugging',
                'Configurable retry policies and rate limiting',
                'Inspect event payloads and delivery logs',
                'Team-based access with role management',
              ] as const).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <AuthFooterLink prompt="Need a workspace?" linkLabel="Request access" to="/signup" />
            <AuthFooterLink prompt="First deploy?" linkLabel="Run one-time setup" to="/bootstrap" />
          </div>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {successMessage ? (
          <PageBanner variant="success" title="Setup complete" description={successMessage} />
        ) : null}
        {error ? <PageBanner variant="error" title="Sign in failed" description={error} /> : null}

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

        <button
          type="button"
          onClick={toggleForgotHint}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline transition-colors -mt-1"
        >
          Forgot your password?
        </button>
        {showForgotHint ? (
          <p className="-mt-1 rounded-sm border border-border bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Contact your platform administrator to request a password reset.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="sm-btn sm-btn-primary sm-btn-block"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </button>
      </form>
    </AuthLayout>
  )
}
