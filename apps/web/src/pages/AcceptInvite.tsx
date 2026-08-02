import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User } from 'lucide-react'
import { ApiError, acceptInvite, validateInvite } from '@/api/client'
import type { ValidateInviteResponse } from '@/api/types'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

const MIN_PASSWORD_LENGTH = 12

function resolveInviteLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invite_expired') {
      return 'This invite has expired. Ask the person who invited you to send a new link from Admin.'
    }
    if (err.code === 'invite_used') {
      return 'This invite has already been used. Sign in with your account instead.'
    }
    return err.message
  }
  return 'Unable to load invite. Try again, or ask for a new invite link from your administrator.'
}

export function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { session, loading: sessionLoading } = useSession()

  const [invite, setInvite] = useState<ValidateInviteResponse | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : 'This invite link is missing a token.',
  )
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!sessionLoading && session) {
      navigate(getDefaultHomePath(session.user), { replace: true })
    }
  }, [sessionLoading, session, navigate])

  useEffect(() => {
    if (!token || session) {
      return
    }

    let cancelled = false

    validateInvite(token)
      .then((result) => {
        if (!cancelled) {
          setInvite(result)
          setLoading(false)
          setLoadError(null)
          setName(result.invited_name ?? '')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false)
          setLoadError(resolveInviteLoadError(err))
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, session])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      await acceptInvite({ token, name: name.trim(), password })
      navigate('/login', {
        replace: true,
        state: {
          banner: 'invite_accepted',
          message: 'Account created. Sign in with your new password.',
        },
      })
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Unable to accept invite. Try again.',
      )
    } finally {
      setSubmitting(false)
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
            ? 'This link cannot be used. Request a new invite from the person who sent it, or sign in if you already have an account.'
            : description
      }
    >
      {loadError ? (
        <AuthCard>
          <PageBanner variant="error" title="Invite unavailable" description={loadError} />
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>Need a new invite? Ask a workspace owner or platform admin to send another link.</p>
            <AuthFooterLink prompt="Already have an account?" linkLabel="Sign in" to="/login" />
          </div>
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
              onChange={(value) => setName(value)}
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
              onChange={(value) => setPassword(value)}
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
                setConfirmPassword(value)
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

      {!loadError ? (
        <div className="mt-6">
          <AuthFooterLink prompt="Already have an account?" linkLabel="Sign in" to="/login" />
        </div>
      ) : null}
    </AuthLayout>
  )
}
