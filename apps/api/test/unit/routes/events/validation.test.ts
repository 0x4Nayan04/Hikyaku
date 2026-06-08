import { MAX_INGEST_BODY_BYTES } from '@webhook/shared/constants'
import { describe, expect, it } from 'vitest'
import { AppError } from '../../../../src/lib/errors.js'
import { parseEventId, parseIngestBody } from '../../../../src/routes/events/validation.js'

function expectValidationError(fn: () => unknown, message?: string) {
  expect(fn).toThrow(AppError)
  try {
    fn()
  } catch (err) {
    expect(err).toMatchObject({
      statusCode: 400,
      code: 'validation_error',
      ...(message ? { message } : {}),
    })
  }
}

describe('parseIngestBody', () => {
  it('accepts a valid ingest payload', () => {
    expect(
      parseIngestBody({
        idempotency_key: 'order-123',
        type: 'order.paid',
        payload: { amount: 100 },
      }),
    ).toEqual({
      idempotency_key: 'order-123',
      type: 'order.paid',
      payload: { amount: 100 },
    })
  })

  it('rejects a missing idempotency_key', () => {
    expectValidationError(
      () => parseIngestBody({ type: 'order.paid', payload: {} }),
      'idempotency_key is required',
    )
  })

  it('rejects an empty idempotency_key', () => {
    expectValidationError(
      () => parseIngestBody({ idempotency_key: '', type: 'order.paid', payload: {} }),
      'idempotency_key is required',
    )
  })

  it('rejects an idempotency_key longer than 256 characters', () => {
    expectValidationError(() =>
      parseIngestBody({
        idempotency_key: 'k'.repeat(257),
        type: 'order.paid',
        payload: {},
      }),
    )
  })

  it('rejects a missing type', () => {
    expectValidationError(
      () => parseIngestBody({ idempotency_key: 'order-123', payload: {} }),
      'type is required',
    )
  })

  it('rejects an empty type', () => {
    expectValidationError(
      () =>
        parseIngestBody({
          idempotency_key: 'order-123',
          type: '',
          payload: {},
        }),
      'type is required',
    )
  })

  it('rejects a type longer than 128 characters', () => {
    expectValidationError(() =>
      parseIngestBody({
        idempotency_key: 'order-123',
        type: 't'.repeat(129),
        payload: {},
      }),
    )
  })

  it('rejects a missing payload', () => {
    expectValidationError(
      () => parseIngestBody({ idempotency_key: 'order-123', type: 'order.paid' }),
      'Required',
    )
  })

  it('rejects a body larger than 256 KiB', () => {
    expectValidationError(
      () =>
        parseIngestBody({
          idempotency_key: 'order-123',
          type: 'order.paid',
          payload: { data: 'x'.repeat(MAX_INGEST_BODY_BYTES) },
        }),
      'Request body must be 256 KiB or less',
    )
  })
})

describe('parseEventId', () => {
  it('accepts a valid uuid', () => {
    expect(() => parseEventId('770e8400-e29b-41d4-a716-446655440002')).not.toThrow()
  })

  it('rejects a malformed event id', () => {
    expect(() => parseEventId('not-a-uuid')).toThrow(AppError)
    try {
      parseEventId('not-a-uuid')
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 404,
        code: 'not_found',
        message: 'Event not found',
      })
    }
  })
})
