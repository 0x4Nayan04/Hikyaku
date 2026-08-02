declare global {
  namespace Express {
    interface Request {
      requestId: string
      tenantId?: string
      userId?: string
      isSuperAdmin?: boolean
    }
  }
}

export {}
