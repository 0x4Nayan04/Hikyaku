import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, KeyRound, Lock, Mail, Shield, User } from 'lucide-react'
import { ApiError, bootstrap, getBootstrapStatus } from '@/api/client'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

type BootstrapState = {
  adminSecret: string
  name: string
  email: string
  password: string
  error: string | null
  submitting: boolean
}

type BootstrapAction =
  | { type: 'set_admin_secret'; value: string }
  | { type: 'set_name'; value: string }
  | { type: 'set_email'; value: string }
  | { type: 'set_password'; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_success' }
  | { type: 'submit_failure'; error: string }
  | { type: 'submit_end' }

const initialBootstrapState: BootstrapState = {
  adminSecret: '',
  name: '',
  email: '',
  password: '',
  error: null,
  submitting: false,
}

function bootstrapReducer(state: BootstrapState, action: BootstrapAction): BootstrapState {
  switch (action.type) {
    case 'set_admin_secret':
      return { ...state, adminSecret: action.value }
    case 'set_name':
      return { ...state, name: action.value }
    case 'set_email':
      return { ...state, email: action.value }
    case 'set_password':
      return { ...state, password: action.value }
    case 'submit_start':
      return { ...state, error: null, submitting: true }
    case 'submit_success':
      return { ...state, error: null }
    case 'submit_failure':
      return { ...state, error: action.error }
    case 'submit_end':
      return { ...state, submitting: false }
    default: {
      action satisfies never
      return state
    }
  }
}

export function Bootstrap() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [state, dispatch] = useReducer(bootstrapReducer, initialBootstrapState)
  const { adminSecret, name, email, password, error, submitting } = state
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
    dispatch({ type: 'submit_start' })

    try {
      await bootstrap(adminSecret, { name, email, password })
      dispatch({ type: 'submit_success' })
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
          dispatch({
            type: 'submit_failure',
            error: 'Bootstrap is disabled because a user already exists. Sign in instead.',
          })
        } else {
          dispatch({ type: 'submit_failure', error: err.message })
        }
      } else {
        dispatch({ type: 'submit_failure', error: 'Unable to complete setup. Try again.' })
      }
    } finally {
      dispatch({ type: 'submit_end' })
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
                After bootstrap, use Admin to approve signups and provision tenants.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              {([
                'Approve signups and invite tenant owners',
                'Invite platform admins',
                'Inspect platform audit activity',
                'Tenant consoles are separate from Admin',
              ] as const).map((item) => (
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
            onChange={(value) => dispatch({ type: 'set_admin_secret', value })}
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
            onChange={(value) => dispatch({ type: 'set_name', value })}
            required
          />
          <AuthFormField
            id="email"
            label="Email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={(value) => dispatch({ type: 'set_email', value })}
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
            onChange={(value) => dispatch({ type: 'set_password', value })}
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
