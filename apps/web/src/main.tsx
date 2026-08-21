import { DocumentTitle } from '@/components/DocumentTitle'
import { SkipLink } from '@/components/SkipLink'
import { SessionProvider } from '@/providers/SessionProvider'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Dev-only agent tooling — never ship in production builds.
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_REACT_GRAB === 'true') {
  void import('react-grab').then((m) =>
    m.init({
      activationKey: 'g',
      activationMode: 'toggle',
      allowActivationInsideInput: true,
      maxContextLines: 3,
    }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <SkipLink />
        <DocumentTitle />
        <App />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
