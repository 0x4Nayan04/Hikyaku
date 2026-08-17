type Toastify = typeof import('react-toastify').toast

let toastReady: Promise<Toastify> | null = null

function loadToast(): Promise<Toastify> {
  if (!toastReady) {
    toastReady = Promise.all([
      import('react-toastify'),
      import('@/components/ui/toast-container'),
      import('react-toastify/dist/ReactToastify.css'),
      import('@/styles/domains/toast.css'),
    ]).then(([mod, container]) => {
      container.mountToastContainer()
      return mod.toast
    })
  }
  return toastReady
}

export const toast = {
  success(message: string) {
    return loadToast().then((rToast) => rToast.success(message))
  },
  error(message: string) {
    return loadToast().then((rToast) => rToast.error(message))
  },
}
