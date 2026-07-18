import { DELIVERY_STATUSES } from '@webhook/shared/constants'
import { describe, expect, it } from 'vitest'
import { AppError } from '../../../../src/lib/errors.js'
import {
  assertReplayableStatus,
  parseDeliveryId,
  parseListQuery,
} from '../../../../src/routes/deliveries/validation.js'

describe('parseDeliveryId', () => {
  it('accepts a valid uuid', () => {
    expect(() => parseDeliveryId('880e8400-e29b-41d4-a716-446655440003')).not.toThrow()
  })

  it('rejects a non-uuid with 404', () => {
    expect(() => parseDeliveryId('not-a-uuid')).toThrow(AppError)
    try {
      parseDeliveryId('not-a-uuid')
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 404,
        code: 'not_found',
        message: 'Delivery not found',
      })
    }
  })
})

describe('assertReplayableStatus', () => {
  it('allows failed deliveries', () => {
    expect(() => assertReplayableStatus('failed')).not.toThrow()
  })

  it.each(DELIVERY_STATUSES.filter((status) => status !== 'failed'))(
    'rejects %s with invalid_state',
    (status) => {
      expect(() => assertReplayableStatus(status)).toThrow(AppError)
      try {
        assertReplayableStatus(status)
      } catch (err) {
        expect(err).toMatchObject({
          statusCode: 400,
          code: 'invalid_state',
          message: 'Only failed deliveries can be replayed',
        })
      }
    },
  )
})

describe('parseListQuery', () => {
  it('returns no filter when status and event_id are omitted', () => {
    expect(parseListQuery({})).toEqual({})
  })

  it('accepts a valid status filter', () => {
    expect(parseListQuery({ status: 'succeeded' })).toEqual({ status: 'succeeded' })
  })

  it('rejects an invalid status filter', () => {
    expect(() => parseListQuery({ status: 'paused' })).toThrow(AppError)
    try {
      parseListQuery({ status: 'paused' })
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'validation_error' })
    }
  })

  it('accepts a valid event_id filter', () => {
    expect(
      parseListQuery({ event_id: '550e8400-e29b-41d4-a716-446655440000' }),
    ).toEqual({ eventId: '550e8400-e29b-41d4-a716-446655440000' })
  })

  it('accepts status and event_id together', () => {
    expect(
      parseListQuery({
        status: 'failed',
        event_id: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toEqual({
      status: 'failed',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
    })
  })

  it('rejects an invalid event_id filter', () => {
    expect(() => parseListQuery({ event_id: 'not-a-uuid' })).toThrow(AppError)
    try {
      parseListQuery({ event_id: 'not-a-uuid' })
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: 'validation_error',
        message: 'Invalid event_id filter',
      })
    }
  })
})
