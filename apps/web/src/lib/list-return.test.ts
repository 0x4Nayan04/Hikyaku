import { describe, expect, it } from 'vitest'
import { getListReturnTo, isPlainPrimaryClick } from './list-return'

describe('getListReturnTo', () => {
  it('preserves query and hash only for the matching list route', () => {
    expect(
      getListReturnTo(
        { listReturnTo: '/deliveries?event_id=e1&status=failed&updated_within=7d#page-2' },
        '/deliveries',
      ),
    ).toBe('/deliveries?event_id=e1&status=failed&updated_within=7d#page-2')
    expect(getListReturnTo({ listReturnTo: '/events?status=pending#recent' }, '/events')).toBe(
      '/events?status=pending#recent',
    )
  })

  it.each([
    'https://evil.example/deliveries',
    '//evil.example/deliveries',
    '/events?status=failed',
    '/deliveries/123',
    '/deliveries\\evil',
    '/deliveries?next=\\\\evil',
    '/deliveries?status=%ZZ',
    'not a url',
  ])('falls back to list root for invalid value %s', (value) => {
    expect(getListReturnTo({ listReturnTo: value }, '/deliveries')).toBe('/deliveries')
  })

  it('falls back when there is no navigation state', () => {
    expect(getListReturnTo(null, '/events')).toBe('/events')
  })
})

describe('isPlainPrimaryClick', () => {
  it('allows only an unmodified primary click', () => {
    expect(
      isPlainPrimaryClick({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true)
    expect(
      isPlainPrimaryClick({
        button: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false)
    expect(
      isPlainPrimaryClick({
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false)
  })
})
