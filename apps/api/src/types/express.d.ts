import type { Logger } from 'pino'
import type { TenantStatus } from '@webhook/shared/constants'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      log: Logger
      tenantId?: string
      tenantStatus?: TenantStatus
      userId?: string
      isSuperAdmin?: boolean
    }
  }
}

export {}
