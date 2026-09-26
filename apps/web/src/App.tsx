import { DocumentTitle } from '@/components/DocumentTitle'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { RequireSession } from '@/components/layout/RequireSession'
import { RequireSuperAdmin } from '@/components/layout/RequireSuperAdmin'
import { RequireTenantUser } from '@/components/layout/RequireTenantUser'
import { SkipLink } from '@/components/SkipLink'
import { Landing } from '@/pages/Landing'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const ConsoleLayout = lazy(() => import('@/layouts/ConsoleLayout'))
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite'))
const Bootstrap = lazy(() => import('@/pages/Bootstrap'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Deliveries = lazy(() => import('@/pages/Deliveries'))
const DeliveryDetail = lazy(() => import('@/pages/DeliveryDetail'))
const Endpoints = lazy(() => import('@/pages/Endpoints'))
const EventDetail = lazy(() => import('@/pages/EventDetail'))
const Events = lazy(() => import('@/pages/Events'))
const DocsRoutes = lazy(() => import('@/pages/docs'))
const Name = lazy(() => import('@/pages/Name'))
const Login = lazy(() => import('@/pages/Login'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Admin = lazy(() => import('@/pages/Admin'))
const SendEvent = lazy(() => import('@/pages/SendEvent'))
const Settings = lazy(() => import('@/pages/Settings'))
const TenantAdmin = lazy(() => import('@/pages/TenantAdmin'))

function PublicRouteFallback() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-label="Loading"
    >
      <HikyakuMark decorative className="size-10 opacity-80" />
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
        Loading
      </p>
    </div>
  )
}

export default function App() {
  return (
    <>
      <SkipLink />
      <DocumentTitle />
      <Suspense fallback={<PublicRouteFallback />}>
        <Routes>
          <Route path="/docs/*" element={<DocsRoutes />} />
          <Route path="/" element={<Landing />} />
          <Route path="/why-haiku" element={<Name />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bootstrap" element={<Bootstrap />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route element={<ConsoleLayout />}>
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
              <Route
                path="settings/profile"
                element={<Navigate to="/settings?tab=profile" replace />}
              />
              <Route element={<RequireSuperAdmin />}>
                <Route path="admin" element={<Admin />} />
                <Route path="admin/tenants/:id" element={<TenantAdmin />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
