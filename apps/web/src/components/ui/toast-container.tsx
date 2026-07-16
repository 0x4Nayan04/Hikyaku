import { ToastContainer as RToastContainer, type ToastContainerProps } from 'react-toastify'

const ToastContainer = (props: ToastContainerProps) => {
  return (
    <RToastContainer
      position="bottom-right"
      closeButton
      hideProgressBar
      newestOnTop
      pauseOnFocusLoss={false}
      draggable={false}
      {...props}
    />
  )
}

export { ToastContainer }
