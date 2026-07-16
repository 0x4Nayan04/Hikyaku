import { deliveries } from '@webhook/shared/schema'
import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { getTenantId } from '../../lib/tenant.js'
import { toDeliveryListJson } from './serialize.js'

const SSE_POLL_INTERVAL_MS = process.env.VITEST === 'true' ? 100 : 1_000
const SSE_HEARTBEAT_INTERVAL_MS = 15_000

const deliveryColumns = {
  id: deliveries.id,
  eventId: deliveries.eventId,
  endpointId: deliveries.endpointId,
  status: deliveries.status,
  attemptCount: deliveries.attemptCount,
  nextRetryAt: deliveries.nextRetryAt,
  lastError: deliveries.lastError,
  createdAt: deliveries.createdAt,
  updatedAt: deliveries.updatedAt,
}

type DeliveryRow = {
  id: string
  eventId: string
  endpointId: string
  status: string
  attemptCount: number
  nextRetryAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export function deliveryFingerprint(row: DeliveryRow): string {
  return JSON.stringify({
    status: row.status,
    attempt_count: row.attemptCount,
    next_retry_at: row.nextRetryAt?.toISOString() ?? null,
    last_error: row.lastError,
    updated_at: row.updatedAt.toISOString(),
  })
}

export function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

async function loadTenantDeliveries(tenantId: string): Promise<DeliveryRow[]> {
  const db = getDb()
  return db.select(deliveryColumns).from(deliveries).where(eq(deliveries.tenantId, tenantId))
}

export async function streamDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = getTenantId(req)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const snapshots = new Map<string, string>()
    let closed = false

    const poll = async () => {
      if (closed) {
        return
      }

      try {
        const rows = await loadTenantDeliveries(tenantId)

        for (const row of rows) {
          const fingerprint = deliveryFingerprint(row)
          const previous = snapshots.get(row.id)

          if (previous === undefined) {
            snapshots.set(row.id, fingerprint)
            continue
          }

          if (previous !== fingerprint) {
            snapshots.set(row.id, fingerprint)
            writeSseEvent(res, 'delivery_updated', toDeliveryListJson(row))
          }
        }
      } catch {
        if (!closed) {
          res.end()
        }
      }
    }

    const pollTimer = setInterval(() => {
      void poll()
    }, SSE_POLL_INTERVAL_MS)

    const heartbeatTimer = setInterval(() => {
      if (!closed) {
        res.write(': keepalive\n\n')
      }
    }, SSE_HEARTBEAT_INTERVAL_MS)

    req.on('close', () => {
      closed = true
      clearInterval(pollTimer)
      clearInterval(heartbeatTimer)
    })

    await poll()
  } catch (err) {
    next(err)
  }
}
