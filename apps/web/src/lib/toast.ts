import { toast as rToast } from 'react-toastify'

type ToastMessage = string

const icons = {
  success: null,
  error: null,
  info: null,
  warning: null,
}

export const toast = {
  success(message: ToastMessage) {
    return rToast.success(message, { icon: icons.success })
  },
  error(message: ToastMessage) {
    return rToast.error(message, { icon: icons.error })
  },
  info(message: ToastMessage) {
    return rToast.info(message, { icon: icons.info })
  },
  warning(message: ToastMessage) {
    return rToast.warning(message, { icon: icons.warning })
  },
  loading(message: ToastMessage) {
    return rToast.loading(message)
  },
  dismiss(id?: string | number) {
    rToast.dismiss(id)
  },
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    opts: {
      loading: string
      success: string
      error: string
    },
  ) {
    return rToast.promise(promise, opts)
  },
}
