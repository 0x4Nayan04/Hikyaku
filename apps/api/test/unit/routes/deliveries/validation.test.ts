import { describe, expect, it } from 'vitest'
import { AppError } from '../../../../src/lib/errors.js'
import {
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

describe('parseListQuery', () => {
  it('returns no filter when status is omitted', () => {
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
})
