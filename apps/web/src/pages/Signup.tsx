import { useEffect, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Check, Lock, Mail, User } from 'lucide-react'
import { ApiError, createSignupRequest } from '@/api/client'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

const MIN_PASSWORD_LENGTH = 12

type SignupState = {
  tenantName: string
  name: string
  email: string
  password: string
  error: string | null
  submitting: boolean
}

type SignupAction =
  | { type: 'set_tenant_name'; value: string }
  | { type: 'set_name'; value: string }
  | { type: 'set_email'; value: string }
  | { type: 'set_password'; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_failure'; error: string }
  | { type: 'submit_end' }

const initialSignupState: SignupState = {
  tenantName: '',
  name: '',
  email: '',
  password: '',
  error: null,
  submitting: false,
}

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case 'set_tenant_name':
      return { ...state, tenantName: action.value }
    case 'set_name':
      return { ...state, name: action.value }
    case 'set_email':
      return { ...state, email: action.value }
    case 'set_password':
      return { ...state, password: action.value }
    case 'submit_start':
      return { ...state, error: null, submitting: true }
    case 'submit_failure':
      return { ...state, error: action.error, submitting: false }
    case 'submit_end':
      return { ...state, submitting: false }
    default: {
      action satisfies never
      return state
    }
  }
}

export function Signup() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [state, dispatch] = useReducer(signupReducer, initialSignupState)

  useEffect(() => {
    if (!loading && session) {
      navigate(getDefaultHomePath(session.user), { replace: true })
    }
  }, [loading, session, navigate])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (state.password.length < MIN_PASSWORD_LENGTH) {
      dispatch({
        type: 'submit_failure',
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
      return
    }

    dispatch({ type: 'submit_start' })

    try {
      await createSignupRequest({
        tenant_name: state.tenantName.trim(),
        name: state.name.trim(),
        email: state.email.trim(),
        password: state.password,
      })

      navigate('/login', {
        replace: true,
        state: {
          message:
            'Signup request submitted. A platform admin will review it. You can sign in after approval.',
        },
      })
    } catch (err) {
      dispatch({
        type: 'submit_failure',
        error:
          err instanceof ApiError ? err.message : 'Unable to submit signup request. Try again.',
      })
    } finally {
      dispatch({ type: 'submit_end' })
    }
  }

  return (
    <AuthLayout
      variant="split"
      eyebrow="Request access"
      title="Sign up for a tenant workspace"
      description="Create a dedicated workspace for your company and request access to the delivery console."
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

          <div className="space-y-4">
            <div className="rounded-sm border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Approval required</p>
              <p className="mt-1">
                A platform admin reviews your request. You can sign in after your account is approved.
              </p>
            </div>
            <AuthFooterLink prompt="Already have an account?" linkLabel="Sign in" to="/login" />
          </div>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {state.error ? (
          <PageBanner variant="error" title="Signup failed" description={state.error} />
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Workspace
          </h2>
          <AuthFormField
            id="tenant_name"
            label="Company / tenant name"
            type="text"
            icon={Building2}
            autoComplete="organization"
            value={state.tenantName}
            onChange={(value) => dispatch({ type: 'set_tenant_name', value })}
            required
          />
        </section>

        <hr className="border-border/60" />

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
            Account
          </h2>
          <AuthFormField
            id="name"
            label="Your name"
            type="text"
            icon={User}
            autoComplete="name"
            value={state.name}
            onChange={(value) => dispatch({ type: 'set_name', value })}
            required
          />
          <AuthFormField
            id="email"
            label="Work email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={state.email}
            onChange={(value) => dispatch({ type: 'set_email', value })}
            required
          />
          <AuthFormField
            id="password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            value={state.password}
            onChange={(value) => dispatch({ type: 'set_password', value })}
            hint={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
        </section>

        <button
          type="submit"
          disabled={state.submitting}
          className="sm-btn sm-btn-primary sm-btn-block"
        >
          {state.submitting ? 'Submitting…' : 'Request access'}
          {!state.submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </button>
      </form>
    </AuthLayout>
  )
}