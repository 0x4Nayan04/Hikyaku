import { z } from 'zod'
import { ENDPOINT_STATUSES } from './constants.js'

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

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>
export type PatchEndpointInput = z.infer<typeof patchEndpointSchema>
