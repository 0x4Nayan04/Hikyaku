if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_REACT_GRAB === 'true') {
  import('react-grab')
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import 'react-toastify/dist/ReactToastify.css'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from '@/components/ui/toast-container'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SessionProvider } from '@/providers/SessionProvider'
import './index.css'
import App from './App.tsx'

const toaster = <ToastContainer />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Dark mode deferred (#66) — light catalog theme only for v1 */}
    <SessionProvider>
      <BrowserRouter>
        <TooltipProvider>
          <App />
          {toaster}
        </TooltipProvider>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
