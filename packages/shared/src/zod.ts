import { z } from 'zod'
import { ENDPOINT_STATUSES, MAX_INGEST_BODY_BYTES } from './constants.js'

const emailSchema = z.string().trim().toLowerCase().email().max(320)
const userNameSchema = z.string().trim().min(1).max(256)
const newPasswordByteLimit = (value: string) => Buffer.byteLength(value, 'utf8') <= 128
const newPasswordSchema = z.string().min(12).refine(newPasswordByteLimit, {
  message: 'Password must be 128 UTF-8 bytes or fewer',
})

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonNumberSchema = z
  .number()
  .finite()
  .refine((value) => !Object.is(value, -0), {
    message: 'JSON numbers must be finite and cannot be negative zero',
  })
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    jsonNumberSchema,
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
)

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
    payload: z.record(z.string(), jsonValueSchema),
  })
  .refine((data) => JSON.stringify(data).length <= MAX_INGEST_BODY_BYTES, {
    message: 'Request body must be 256 KiB or less',
  })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})

export const bootstrapSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  name: userNameSchema,
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: newPasswordSchema,
})

export const adminPatchTenantSchema = z.object({
  tenant_name: userNameSchema,
})

const optionalInviteNameSchema = userNameSchema.optional()

const adminCreateTenantOwnerInviteSchema = z.object({
  kind: z.literal('tenant_owner'),
  tenant_name: userNameSchema,
  owner_email: emailSchema,
  owner_name: optionalInviteNameSchema,
})

const adminCreateTenantUserInviteSchema = z.object({
  kind: z.literal('tenant_user'),
  tenant_id: z.string().uuid(),
  email: emailSchema,
  name: optionalInviteNameSchema,
})

export const adminCreateInviteSchema = z.discriminatedUnion('kind', [
  adminCreateTenantOwnerInviteSchema,
  adminCreateTenantUserInviteSchema,
])

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: userNameSchema,
  password: newPasswordSchema,
})

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>
export type PatchEndpointInput = z.infer<typeof patchEndpointSchema>
export type IngestEventInput = z.infer<typeof ingestEventSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type BootstrapInput = z.infer<typeof bootstrapSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type AdminCreateInviteInput = z.infer<typeof adminCreateInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
