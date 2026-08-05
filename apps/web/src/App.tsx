import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireSession } from '@/components/layout/RequireSession'
import { RequireSuperAdmin } from '@/components/layout/RequireSuperAdmin'
import { RequireTenantUser } from '@/components/layout/RequireTenantUser'
import { PageLoading } from '@/components/console/PageLoading'
import { ConsoleLayout } from '@/layouts/ConsoleLayout'
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite').then(({ AcceptInvite }) => ({ default: AcceptInvite })))
const Bootstrap = lazy(() => import('@/pages/Bootstrap').then(({ Bootstrap }) => ({ default: Bootstrap })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then(({ Dashboard }) => ({ default: Dashboard })))
const Deliveries = lazy(() => import('@/pages/Deliveries').then(({ Deliveries }) => ({ default: Deliveries })))
const DeliveryDetail = lazy(() => import('@/pages/DeliveryDetail').then(({ DeliveryDetail }) => ({ default: DeliveryDetail })))
const Endpoints = lazy(() => import('@/pages/Endpoints').then(({ Endpoints }) => ({ default: Endpoints })))
const EventDetail = lazy(() => import('@/pages/EventDetail').then(({ EventDetail }) => ({ default: EventDetail })))
const Events = lazy(() => import('@/pages/Events').then(({ Events }) => ({ default: Events })))
const DocsRoutes = lazy(() => import('@/pages/docs').then(({ DocsRoutes }) => ({ default: DocsRoutes })))
const Landing = lazy(() => import('@/pages/Landing').then(({ Landing }) => ({ default: Landing })))
const Login = lazy(() => import('@/pages/Login').then(({ Login }) => ({ default: Login })))
const NotFound = lazy(() => import('@/pages/NotFound').then(({ NotFound }) => ({ default: NotFound })))
const Admin = lazy(() => import('@/pages/Admin').then(({ Admin }) => ({ default: Admin })))
const SendEvent = lazy(() => import('@/pages/SendEvent').then(({ SendEvent }) => ({ default: SendEvent })))
const Settings = lazy(() => import('@/pages/Settings').then(({ Settings }) => ({ default: Settings })))
const TenantAdmin = lazy(() => import('@/pages/TenantAdmin').then(({ TenantAdmin }) => ({ default: TenantAdmin })))

export default function App() {
  return (
    <Suspense fallback={<main className="app-main"><PageLoading /></main>}>
      <Routes>
      <Route path="/docs/*" element={<DocsRoutes />} />
      {/* Marketing home stays viewable while logged in (role CTAs in nav). */}
      <Route path="/" element={<Landing />} />
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
  )
}
