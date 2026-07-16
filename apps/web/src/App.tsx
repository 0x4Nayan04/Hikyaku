import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireGuest } from '@/components/layout/RequireGuest'
import { RequireSession } from '@/components/layout/RequireSession'
import { RequireSuperAdmin } from '@/components/layout/RequireSuperAdmin'
import { RequireTenantUser } from '@/components/layout/RequireTenantUser'
import { AppLayout } from '@/layouts/AppLayout'
import { AcceptInvite } from '@/pages/AcceptInvite'
import { Bootstrap } from '@/pages/Bootstrap'
import { Dashboard } from '@/pages/Dashboard'
import { Deliveries } from '@/pages/Deliveries'
import { DeliveryDetail } from '@/pages/DeliveryDetail'
import { Endpoints } from '@/pages/Endpoints'
import { EventDetail } from '@/pages/EventDetail'
import { Events } from '@/pages/Events'
import { DocsRoutes } from '@/pages/docs'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Signup } from '@/pages/Signup'
import { Admin } from '@/pages/Admin'
import { SendEvent } from '@/pages/SendEvent'
import { Settings } from '@/pages/Settings'
import { TenantAdmin } from '@/pages/TenantAdmin'

export default function App() {
  return (
    <Routes>
      <Route path="/docs/*" element={<DocsRoutes />} />
      <Route element={<RequireGuest />}>
        <Route path="/" element={<Landing />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/bootstrap" element={<Bootstrap />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route element={<AppLayout />}>
        <Route element={<RequireSession />}>
          <Route element={<RequireTenantUser />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="endpoints" element={<Endpoints />} />
            <Route path="events" element={<Events />} />
            <Route path="events/send" element={<SendEvent />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="deliveries/:id" element={<DeliveryDetail />} />
          </Route>
          <Route path="settings" element={<Settings />} />
          <Route path="settings/profile" element={<Navigate to="/settings?tab=profile" replace />} />
          <Route element={<RequireSuperAdmin />}>
            <Route path="admin" element={<Admin />} />
            <Route path="admin/tenants/:id" element={<TenantAdmin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
