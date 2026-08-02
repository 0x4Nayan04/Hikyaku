import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, KeyRound, Lock, Mail, Shield, User } from 'lucide-react'
import { ApiError, bootstrap, getBootstrapStatus } from '@/api/client'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

export function Bootstrap() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [adminSecret, setAdminSecret] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)

  useEffect(() => {
    if (!loading && session) {
      navigate(getDefaultHomePath(session.user), { replace: true })
    }
  }, [loading, session, navigate])

  useEffect(() => {
    if (loading || session) {
      return
    }

    let cancelled = false

    getBootstrapStatus()
      .then((status) => {
        if (cancelled) {
          return
        }
        if (!status.available) {
          navigate('/login', {
            replace: true,
            state: {
              banner: 'already_set_up',
              message: 'This deployment is already set up. Sign in with your account.',
            },
          })
          return
        }
        setCheckingAvailability(false)
      })
      .catch(() => {
        if (!cancelled) {
          navigate('/login', {
            replace: true,
            state: {
              banner: 'already_set_up',
              message: 'This deployment is already set up. Sign in with your account.',
            },
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, session, navigate])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await bootstrap(adminSecret, { name, email, password })
      navigate('/login', {
        replace: true,
        state: {
          banner: 'bootstrap_complete',
          message: 'Super-admin created. Sign in to continue.',
        },
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'forbidden') {
          setError('Bootstrap is disabled because a user already exists. Sign in instead.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Unable to complete setup. Try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingAvailability) {
    return (
      <AuthLayout
        variant="split"
        eyebrow="One-time setup"
        title="Checking setup…"
        description="Verifying whether first-deploy bootstrap is still available."
      >
        <p className="text-sm text-muted-foreground">Checking deployment status…</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      variant="split"
      eyebrow="One-time setup"
      title="Create the first super-admin"
      description="Runs once per deployment to create the initial platform admin."
      sidePanel={
        <div className="flex flex-col gap-6 h-full">
          <div className="flex flex-col gap-6 flex-1">
            <div>
              <h2 className="font-display text-xl font-medium tracking-tight text-ink">
                Delivery console
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">
                After bootstrap, use Admin to invite tenant owners.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              {(
                [
                  'Invite tenant owners',
                  'Manage tenant users',
                  'Rename or delete tenants',
                  'Tenant consoles are separate from Admin',
                ] as const
              ).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-none border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Bootstrap secret</p>
              <p className="mt-1">
                Use <code className="text-xs">ADMIN_BOOTSTRAP_SECRET</code> from your deployment
                environment. It is sent once with this request and is not stored in the browser.
              </p>
            </div>
          </div>

          <AuthFooterLink prompt="Already set up?" linkLabel="Sign in" to="/login" />
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {error ? <PageBanner variant="error" title="Setup failed" description={error} /> : null}

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Verify deployment
          </h2>
          <AuthFormField
            id="admin-secret"
            label="Admin bootstrap secret"
            type="password"
            icon={Shield}
            autoComplete="off"
            value={adminSecret}
            onChange={(value) => setAdminSecret(value)}
            required
          />
        </section>

        <hr className="border-border/60" />

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Super-admin account
          </h2>
          <AuthFormField
            id="name"
            label="Full name"
            icon={User}
            autoComplete="name"
            value={name}
            onChange={(value) => setName(value)}
            required
          />
          <AuthFormField
            id="email"
            label="Email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={(value) => setEmail(value)}
            required
          />
          <AuthFormField
            id="password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(value) => setPassword(value)}
            hint="Use at least 12 characters."
            required
          />
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="sm-btn sm-btn-primary sm-btn-block inline-flex items-center justify-center gap-2"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {submitting ? 'Creating super-admin…' : 'Create super-admin'}
        </button>
      </form>
    </AuthLayout>
  )
}
