import { SIGNUP_REQUEST_STATUSES } from '@webhook/shared/constants'
import { AppError } from '../../lib/errors.js'

export function parseSignupRequestId(id: unknown): string {
  if (typeof id !== 'string' || !id) {
    throw new AppError(400, 'validation_error', 'Signup request id is required')
  }
  return id
}

export function parseSignupRequestStatusFilter(status: unknown): string | undefined {
  if (status === undefined || status === null || status === '') {
    return undefined
  }

  if (typeof status !== 'string') {
    throw new AppError(400, 'validation_error', 'status must be a string')
  }

  if (!(SIGNUP_REQUEST_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, 'validation_error', 'Invalid signup request status')
  }

  return status
}
