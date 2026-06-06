import { describe, expect, it } from 'vitest'
import { parseCreateBody, parsePatchBody } from '../../../src/routes/endpoints/validation.js'
import { AppError } from '../../../src/lib/errors.js'

describe('parseCreateBody', () => {
  it('accepts a valid create payload', () => {
    expect(parseCreateBody({ url: 'https://example.com/hook', description: 'prod' })).toEqual({
      url: 'https://example.com/hook',
      description: 'prod',
    })
  })

  it('rejects a missing url', () => {
    expect(() => parseCreateBody({ description: 'prod' })).toThrow(AppError)
    try {
      parseCreateBody({ description: 'prod' })
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'validation_error' })
    }
  })

  it('rejects an invalid url', () => {
    expect(() => parseCreateBody({ url: 'not-a-url' })).toThrow(AppError)
    try {
      parseCreateBody({ url: 'not-a-url' })
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'validation_error' })
    }
  })

  it('rejects a description longer than 512 characters', () => {
    expect(() =>
      parseCreateBody({ url: 'https://example.com/hook', description: 'x'.repeat(513) }),
    ).toThrow(AppError)
  })
})

describe('parsePatchBody', () => {
  it('accepts a status update', () => {
    expect(parsePatchBody({ status: 'disabled' })).toEqual({ status: 'disabled' })
  })

  it('rejects an empty patch body', () => {
    expect(() => parsePatchBody({})).toThrow(AppError)
    try {
      parsePatchBody({})
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'validation_error' })
    }
  })

  it('rejects an invalid status value', () => {
    expect(() => parsePatchBody({ status: 'paused' })).toThrow(AppError)
    try {
      parsePatchBody({ status: 'paused' })
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'validation_error' })
    }
  })

  it('rejects attempts to change url', () => {
    expect(() => parsePatchBody({ url: 'https://evil.com/hook' })).toThrow(AppError)
    try {
      parsePatchBody({ url: 'https://evil.com/hook' })
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: 'immutable_field',
        message: 'url cannot be changed',
      })
    }
  })

  it('rejects attempts to change secret', () => {
    expect(() => parsePatchBody({ secret: 'whsec_deadbeef' })).toThrow(AppError)
    try {
      parsePatchBody({ secret: 'whsec_deadbeef' })
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: 'immutable_field',
        message: 'secret cannot be changed',
      })
    }
  })

  it('rejects url even when paired with a valid status update', () => {
    expect(() => parsePatchBody({ status: 'disabled', url: 'https://evil.com/hook' })).toThrow(
      AppError,
    )
    try {
      parsePatchBody({ status: 'disabled', url: 'https://evil.com/hook' })
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, code: 'immutable_field' })
    }
  })
})
