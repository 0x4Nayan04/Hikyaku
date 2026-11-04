import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BootstrapInput } from '@hikyaku/shared/zod'
import { ApiError, bootstrap } from '@/api/client'
import { getDefaultHomePath } from '@/lib/auth/auth-redirect'
import { loadBootstrapStatus, writeBootstrapStatusCache } from '@/lib/auth/bootstrap-status'
import { useSession } from '@/providers/session-context'

export function useBootstrapSetup() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [status, setStatus] = useState<'checking' | 'available' | 'error'>('checking')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loading) return
    if (session) {
      navigate(getDefaultHomePath(session.user), { replace: true })
      return
    }
    let cancelled = false
    loadBootstrapStatus()
      .then((available) => {
        if (cancelled) return
        if (!available) {
          navigate('/login', {
            replace: true,
            state: {
              banner: 'already_set_up',
              message: 'This deployment is already set up. Sign in with your account.',
            },
          })
        } else setStatus('available')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'Unable to check setup availability. Check your connection and try again.',
        )
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [loading, session, navigate, attempt])

  function retry() {
    setLoadError(null)
    setStatus('checking')
    setAttempt((value) => value + 1)
  }

  async function submit(secret: string, body: BootstrapInput) {
    setError(null)
    setSubmitting(true)
    try {
      await bootstrap(secret, body)
      writeBootstrapStatusCache(false)
      navigate('/login', {
        replace: true,
        state: {
          banner: 'bootstrap_complete',
          message: 'Account and workspace created. Sign in to send your first webhook.',
        },
      })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'forbidden'
            ? 'Bootstrap is disabled because a user already exists. Sign in instead.'
            : err.message
          : 'Unable to complete setup. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return { status, loadError, error, submitting, retry, submit }
}
