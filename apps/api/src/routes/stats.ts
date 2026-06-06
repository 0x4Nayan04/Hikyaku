import { Router, type IRouter } from 'express'
import { requireAuth } from '../auth/middleware.js'

export const statsRouter: IRouter = Router()

statsRouter.get('/stats', requireAuth, (_req, res) => {
  res.json({
    events_today: 0,
    deliveries_pending: 0,
    deliveries_deferred: 0,
    deliveries_succeeded_24h: 0,
    deliveries_failed_24h: 0,
    success_rate_24h: null,
  })
})

statsRouter.get('/tenants/:tenantId', requireAuth, (req, res) => {
  if (req.params.tenantId !== req.tenantId) {
    res.status(404).json({
      error: { code: 'not_found', message: 'Not found' },
    })
    return
  }

  res.json({ id: req.tenantId })
})
