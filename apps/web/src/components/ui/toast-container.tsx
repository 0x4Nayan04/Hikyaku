import { createRoot } from 'react-dom/client'
import { ToastContainer as RToastContainer } from 'react-toastify'

let mounted = false

export function mountToastContainer(): void {
  if (mounted || typeof document === 'undefined') return
  mounted = true
  const el = document.createElement('div')
  el.id = 'toast-root'
  document.body.appendChild(el)
  createRoot(el).render(
    <RToastContainer
      position="bottom-right"
      closeButton
      hideProgressBar
      newestOnTop
      pauseOnFocusLoss={false}
      draggable={false}
    />,
  )
}
