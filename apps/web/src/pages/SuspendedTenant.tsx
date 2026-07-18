import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { logout } from '@/api/client'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useSession } from '@/providers/session-context'

export function SuspendedTenant() {
  const navigate = useNavigate()
  const { session, refresh } = useSession()
  const tenantName = session?.tenant?.name

  async function handleSignOut() {
    await logout()
    await refresh()
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout
      eyebrow="Workspace suspended"
      title="This workspace is suspended"
      description={
        tenantName
          ? `${tenantName} cannot send or receive webhooks right now. Sign out, then contact your platform admin to restore access.`
          : 'This workspace cannot send or receive webhooks right now. Sign out, then contact your platform admin to restore access.'
      }
    >
      <CatalogButton type="button" className="w-full gap-2" onClick={() => void handleSignOut()}>
        <LogOut className="size-3.5" aria-hidden="true" />
        Sign out
      </CatalogButton>
    </AuthLayout>
  )
}
