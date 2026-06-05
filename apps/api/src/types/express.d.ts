import type { Logger } from 'pino'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      log: Logger
      tenantId?: string
    }
  }
}

export {}
