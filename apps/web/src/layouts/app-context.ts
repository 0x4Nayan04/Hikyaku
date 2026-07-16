import type { MeResponse } from '@/api/types'

export type AppOutletContext = {
  session: MeResponse | null
  loadingSession: boolean
}
