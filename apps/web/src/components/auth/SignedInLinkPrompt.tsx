import { useState } from 'react'
import { ApiError, logout } from '@/api/client'
import { PageBanner } from '@/components/console/PageBanner'
import { useSession } from '@/providers/session-context'

type SignedInLinkPromptProps = {
  currentEmail: string
  targetEmail: string
}

export function SignedInLinkPrompt({ currentEmail, targetEmail }: SignedInLinkPromptProps) {
  const { refresh } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setSubmitting(true)
    setError(null)
    try {
      await logout()
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.code === 'unauthorized') {
        await refresh()
      } else {
        setError('Could not sign out. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-panel border border-border bg-surface p-6">
      {error ? <PageBanner variant="error" title="Could not sign out" description={error} /> : null}
      <p className="text-sm text-muted-foreground">
        You are signed in as <span className="font-medium text-ink">{currentEmail}</span>. Sign out
        to continue with the link for <span className="font-medium text-ink">{targetEmail}</span>.
      </p>
      <button
        type="button"
        disabled={submitting}
        className="sm-btn sm-btn-primary sm-btn-block mt-5"
        onClick={() => void handleSignOut()}
      >
        {submitting ? 'Signing out…' : 'Sign out to continue'}
      </button>
    </div>
  )
}
