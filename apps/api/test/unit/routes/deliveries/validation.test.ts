import { describe, expect, it } from 'vitest'
import { AppError } from '../../../../src/lib/errors.js'
import { parseDeliveryId, parseListQuery } from '../../../../src/routes/deliveries/validation.js'

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

describe('parseListQuery', () => {
  it('returns no filter when status and event_id are omitted', () => {
    expect(parseListQuery({})).toEqual({})
  })

  it('accepts a valid status filter', () => {
    expect(parseListQuery({ status: 'succeeded' })).toEqual({ status: 'succeeded' })
  })

  it('treats open as pending and in progress', () => {
    expect(parseListQuery({ status: 'open' })).toEqual({ open: true })
  })

  it('accepts the 24h updated window', () => {
    expect(parseListQuery({ status: 'failed', updated_within: '24h' })).toEqual({
      status: 'failed',
      updatedWithin24h: true,
    })
  })

  it('rejects an unknown updated_within value', () => {
    expect(() => parseListQuery({ updated_within: '1h' })).toThrow(AppError)
    try {
      parseListQuery({ updated_within: '1h' })
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: 'validation_error',
        message: 'Invalid updated_within filter',
      })
    }
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
    expect(parseListQuery({ event_id: '550e8400-e29b-41d4-a716-446655440000' })).toEqual({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
    })
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
