import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/console/chrome/PageLoading'
import { useSession } from '@/providers/session-context'

export function RequireSession() {
  const { session, loading, error, refresh } = useSession()
  const location = useLocation()

  if (loading) {
    return <PageLoading variant="detail" />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageBanner variant="error" title="Could not load your session" description={error} />
        <Button onClick={() => void refresh()}>Try again</Button>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
