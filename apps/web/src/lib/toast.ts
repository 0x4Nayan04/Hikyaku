import { toast as rToast } from 'react-toastify'

export const toast = {
  success(message: string) {
    return rToast.success(message)
  },
  error(message: string) {
    return rToast.error(message)
  },
}
