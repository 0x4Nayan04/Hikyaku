import { expect, it } from 'vitest'
import { parseListQuery as apiKeys } from '../../src/routes/api-keys/validation.js'
import { parseListQuery as events } from '../../src/routes/events/validation.js'
import { parseListQuery as endpoints } from '../../src/routes/endpoints/validation.js'
import { parseListQuery as deliveries } from '../../src/routes/deliveries/validation.js'
it('rejects nested Express query objects at each scalar filter boundary', () => {
  for (const parse of [events, endpoints, deliveries, apiKeys]) {
    expect(() => parse({ status: { nested: 'pending' } })).toThrow('status must be a string')
    expect(() => parse({ status: [{ nested: 'pending' }] })).toThrow('status must be a string')
  }
  expect(() => deliveries({ event_id: { nested: 'id' } })).toThrow('event_id must be a string')
  expect(() => deliveries({ updated_within: ['24h', '12h'] })).not.toThrow()
})
