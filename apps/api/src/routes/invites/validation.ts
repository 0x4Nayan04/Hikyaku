import { adminCreateInviteSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'

function zodMessage(error: { errors: { message?: string }[] }): string {
  return error.errors[0]?.message ?? 'Validation failed'
}

export function parseCreateInviteBody(body: unknown) {
  const parsed = adminCreateInviteSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}
