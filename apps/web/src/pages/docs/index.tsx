import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { DocsLayout } from '@/layouts/DocsLayout'
import { docsPathForAnchor } from '@/docs/toc'
import { DocsPage } from '@/pages/docs/DocsPage'

/** `/docs` and legacy `/docs#anchor` links land on the owning docs page. */
function DocsIndexRedirect() {
  const anchor = useLocation().hash.slice(1)
  return <Navigate to={docsPathForAnchor(anchor) ?? '/docs/introduction'} replace />
}

export default function DocsRoutes() {
  return (
    <Routes>
      <Route element={<DocsLayout />}>
        <Route index element={<DocsIndexRedirect />} />
        <Route path=":slug" element={<DocsPage />} />
        <Route path="*" element={<DocsIndexRedirect />} />
      </Route>
    </Routes>
  )
}
