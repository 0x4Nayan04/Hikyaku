import { Navigate, Route, Routes } from 'react-router-dom'

import { DocsLayout } from '@/layouts/DocsLayout'
import { ApiKeysPage } from '@/pages/docs/ApiKeysPage'
import { ApiReferencePage } from '@/pages/docs/ApiReferencePage'
import { AuthenticationPage } from '@/pages/docs/AuthenticationPage'
import { ConsoleGuidePage } from '@/pages/docs/ConsoleGuidePage'
import { DocsHome } from '@/pages/docs/DocsHome'
import { EndpointsPage } from '@/pages/docs/EndpointsPage'
import { IngestPage } from '@/pages/docs/IngestPage'
import { IntroductionPage } from '@/pages/docs/IntroductionPage'
import { OutboundPage } from '@/pages/docs/OutboundPage'
import { PrivacyPage } from '@/pages/docs/PrivacyPage'
import { QuickStartPage } from '@/pages/docs/QuickStartPage'
import { RetriesPage } from '@/pages/docs/RetriesPage'
import { SigningPage } from '@/pages/docs/SigningPage'

export function DocsRoutes() {
  return (
    <Routes>
      <Route element={<DocsLayout />}>
        <Route index element={<DocsHome />} />
        <Route path="introduction" element={<IntroductionPage />} />
        <Route path="quick-start" element={<QuickStartPage />} />
        <Route path="authentication" element={<AuthenticationPage />} />
        <Route path="ingest" element={<IngestPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
        <Route path="outbound" element={<OutboundPage />} />
        <Route path="signing" element={<SigningPage />} />
        <Route path="api-reference" element={<ApiReferencePage />} />
        <Route path="retries" element={<RetriesPage />} />
        <Route path="console-guide" element={<ConsoleGuidePage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/docs" replace />} />
      </Route>
    </Routes>
  )
}
