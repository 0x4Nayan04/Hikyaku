import { Landing } from '@/pages/marketing/Landing'
import { DocumentTitle } from '@/components/DocumentTitle'
import { RequireSession } from '@/components/layout/RequireSession'
import { RequireSuperAdmin } from '@/components/layout/RequireSuperAdmin'
import { RequireTenantUser } from '@/components/layout/RequireTenantUser'
import { SkipLink } from '@/components/SkipLink'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { PRODUCT_LINKS } from '@/lib/meta/app-meta'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const ConsoleLayout = lazy(() => import('@/layouts/ConsoleLayout'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Bootstrap = lazy(() => import('@/pages/bootstrap/Bootstrap'))
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const Deliveries = lazy(() => import('@/pages/deliveries/Deliveries'))
const DeliveryDetail = lazy(() => import('@/pages/deliveries/DeliveryDetail'))
const Endpoints = lazy(() => import('@/pages/endpoints/Endpoints'))
const EventDetail = lazy(() => import('@/pages/events/EventDetail'))
const Events = lazy(() => import('@/pages/events/Events'))
const DocsRoutes = lazy(() => import('@/pages/docs'))
const WhyHikyaku = lazy(() => import('@/pages/marketing/WhyHikyaku'))
const Login = lazy(() => import('@/pages/auth/Login'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Admin = lazy(() => import('@/pages/admin/Admin'))
const SendEvent = lazy(() => import('@/pages/events/SendEvent'))
const Settings = lazy(() => import('@/pages/settings/Settings'))
const TenantAdmin = lazy(() => import('@/pages/tenant-admin/TenantAdmin'))

function PublicRouteFallback() {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-background"
      role="status"
      aria-label="Loading"
    >
      <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted-strong">
        Loading
      </span>
    </div>
  )
}

export default function App() {
  return (
    <>
      <SkipLink />
      <DocumentTitle />
      <RouteErrorBoundary fullPage>
        <Suspense fallback={<PublicRouteFallback />}>
          <Routes>
            <Route path="/docs/*" element={<DocsRoutes />} />
            <Route path="/" element={<Landing />} />
            <Route path={PRODUCT_LINKS.whyHikyaku} element={<WhyHikyaku />} />
            <Route path="/why-haiku" element={<Navigate to={PRODUCT_LINKS.whyHikyaku} replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/bootstrap" element={<Bootstrap />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
      </RouteErrorBoundary>
    </>
  )
}
