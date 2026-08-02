import { AppError } from './errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Schema<T> = {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: Array<{ message?: string }> } }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function requireUuid(value: string, notFoundMessage: string): void {
  if (!isUuid(value)) {
    throw new AppError(404, 'not_found', notFoundMessage)
  }
}

export function parseSchema<T>(schema: Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new AppError(
      400,
      'validation_error',
      parsed.error.issues[0]?.message ?? 'Validation failed',
    )
  }
  return parsed.data
}
