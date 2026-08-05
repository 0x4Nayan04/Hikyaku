if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_REACT_GRAB === 'true') {
  import("react-grab").then((m) => m.init({"activationKey":"g","activationMode":"toggle","allowActivationInsideInput":true,"maxContextLines":3}))
}

import { ToastContainer } from '@/components/ui/toast-container'
import { SessionProvider } from '@/providers/SessionProvider'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <App />
        <ToastContainer />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
