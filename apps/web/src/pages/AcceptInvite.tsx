import { useEffect, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User } from 'lucide-react'
import { ApiError, acceptInvite, validateInvite } from '@/api/client'
import type { ValidateInviteResponse } from '@/api/types'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/layouts/AuthLayout'

const MIN_PASSWORD_LENGTH = 12

type AcceptInviteState = {
  invite: ValidateInviteResponse | null
  loading: boolean
  loadError: string | null
  name: string
  password: string
  confirmPassword: string
  submitError: string | null
  submitting: boolean
}

type AcceptInviteAction =
  | { type: 'load_success'; invite: ValidateInviteResponse }
  | { type: 'load_failure'; error: string }
  | { type: 'set_name'; name: string }
  | { type: 'set_password'; password: string }
  | { type: 'set_confirm_password'; confirmPassword: string }
  | { type: 'submit_start' }
  | { type: 'submit_failure'; error: string }
  | { type: 'submit_finished' }
  | { type: 'clear_submit_error' }

function acceptInviteReducer(
  state: AcceptInviteState,
  action: AcceptInviteAction,
): AcceptInviteState {
  switch (action.type) {
    case 'load_success':
      return {
        ...state,
        invite: action.invite,
        loading: false,
        loadError: null,
        name: action.invite.invited_name ?? state.name,
      }
    case 'load_failure':
      return { ...state, loading: false, loadError: action.error }
    case 'set_name':
      return { ...state, name: action.name }
    case 'set_password':
      return { ...state, password: action.password }
    case 'set_confirm_password':
      return { ...state, confirmPassword: action.confirmPassword }
    case 'submit_start':
      return { ...state, submitError: null, submitting: true }
    case 'submit_failure':
      return { ...state, submitError: action.error, submitting: false }
    case 'submit_finished':
      return { ...state, submitting: false }
    case 'clear_submit_error':
      return { ...state, submitError: null }
    default:
      action satisfies never
      return state
  }
}

function resolveInviteLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invite_expired') {
      return 'This invite has expired. Ask your administrator for a new link.'
    }
    if (err.code === 'invite_used') {
      return 'This invite has already been used. Sign in with your account instead.'
    }
    return err.message
  }
  return 'Unable to load invite. Try again or request a new link.'
}

export function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, dispatch] = useReducer(acceptInviteReducer, {
    invite: null,
    loading: Boolean(token),
    loadError: token ? null : 'This invite link is missing a token.',
    name: '',
    password: '',
    confirmPassword: '',
    submitError: null,
    submitting: false,
  })

  const { invite, loading, loadError, name, password, confirmPassword, submitError, submitting } =
    state

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    validateInvite(token)
      .then((result) => {
        if (!cancelled) {
          dispatch({ type: 'load_success', invite: result })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          dispatch({ type: 'load_failure', error: resolveInviteLoadError(err) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'clear_submit_error' })

    if (password !== confirmPassword) {
      dispatch({ type: 'submit_failure', error: 'Passwords do not match.' })
      return
    }

    dispatch({ type: 'submit_start' })

    try {
      await acceptInvite({ token, name: name.trim(), password })
      navigate('/login', {
        replace: true,
        state: { message: 'Account created. Sign in with your new password.' },
      })
    } catch (err) {
      dispatch({
        type: 'submit_failure',
        error: err instanceof ApiError ? err.message : 'Unable to accept invite. Try again.',
      })
    } finally {
      dispatch({ type: 'submit_finished' })
    }
  }

  const title =
    invite?.kind === 'tenant_owner'
      ? `Join ${invite.tenant_name ?? 'your organization'}`
      : 'Accept your invite'

  const description =
    invite?.kind === 'tenant_owner'
      ? 'Set your name and password to create your tenant owner account.'
      : 'Set your name and password to join your team.'

  return (
    <AuthLayout
      eyebrow="Invite"
      title={loading ? 'Checking invite…' : loadError ? 'Invite unavailable' : title}
      description={
        loading
          ? 'Verifying your invite link.'
          : loadError
            ? 'This link cannot be used.'
            : description
      }
    >
      {loadError ? (
        <AuthCard>
          <PageBanner variant="error" title="Invite unavailable" description={loadError} />
        </AuthCard>
      ) : loading ? (
        <AuthCard>
          <p className="text-sm text-muted-foreground">Loading invite details…</p>
        </AuthCard>
      ) : invite ? (
        <AuthCard>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {submitError ? (
              <PageBanner
                variant="error"
                title="Could not accept invite"
                description={submitError}
              />
            ) : null}

            <AuthFormField
              id="email"
              label="Email"
              type="email"
              icon={Mail}
              value={invite.email}
              onChange={() => {}}
              readOnly
              required
            />
            <AuthFormField
              id="name"
              label="Full name"
              icon={User}
              autoComplete="name"
              value={name}
              onChange={(value) => dispatch({ type: 'set_name', name: value })}
              required
            />
            <AuthFormField
              id="password"
              label="Password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(value) => dispatch({ type: 'set_password', password: value })}
              hint={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
              required
            />
            <AuthFormField
              id="confirm-password"
              label="Confirm password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(value) =>
                dispatch({ type: 'set_confirm_password', confirmPassword: value })
              }
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="sm-btn sm-btn-primary sm-btn-block mt-1 inline-flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating account…' : 'Create account'}
              {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </button>
          </form>
        </AuthCard>
      ) : null}

      <div className="mt-6">
        <AuthFooterLink prompt="Already have an account?" linkLabel="Sign in" to="/login" />
      </div>
    </AuthLayout>
  )
}
