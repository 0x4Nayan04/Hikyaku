import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { DocsLayout } from '@/layouts/DocsLayout'
import { legacyDocsHash } from '@/docs/toc'
import { DocsPage } from '@/pages/docs/DocsPage'

function DocsLegacyRedirect() {
  const { slug = '' } = useParams()
  return <Navigate to={`/docs${legacyDocsHash(slug) ?? ''}`} replace />
}

export function DocsRoutes() {
  return (
    <Routes>
      <Route path=":slug" element={<DocsLegacyRedirect />} />
      <Route element={<DocsLayout />}>
        <Route index element={<DocsPage />} />
      </Route>
    </Routes>
  )
}
