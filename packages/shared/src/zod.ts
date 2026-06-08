import { z } from 'zod'
import { ENDPOINT_STATUSES, MAX_INGEST_BODY_BYTES } from './constants.js'

export const createEndpointSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(512).optional(),
})

export const patchEndpointSchema = z
  .object({
    status: z.enum(ENDPOINT_STATUSES).optional(),
    description: z.string().max(512).optional(),
  })
  .refine((data) => data.status !== undefined || data.description !== undefined, {
    message: 'At least one field required',
  })

export const ingestEventSchema = z
  .object({
    idempotency_key: z
      .string({ required_error: 'idempotency_key is required' })
      .min(1, { message: 'idempotency_key is required' })
      .max(256),
    type: z
      .string({ required_error: 'type is required' })
      .min(1, { message: 'type is required' })
      .max(128),
    payload: z.record(z.string(), z.unknown()),
  })
  .refine((data) => JSON.stringify(data).length <= MAX_INGEST_BODY_BYTES, {
    message: 'Request body must be 256 KiB or less',
  })

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>
export type PatchEndpointInput = z.infer<typeof patchEndpointSchema>
export type IngestEventInput = z.infer<typeof ingestEventSchema>
