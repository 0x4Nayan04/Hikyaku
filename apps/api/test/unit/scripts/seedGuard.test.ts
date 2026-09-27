import { describe, expect, it } from 'vitest'
import { assertSeedAllowed } from '../../../src/scripts/seedGuard.js'

describe('assertSeedAllowed', () => {
  it('refuses to seed in production', () => {
    expect(() => assertSeedAllowed('production')).toThrow(
      'Refusing to seed in production. Create the first admin at /bootstrap.',
    )
  })

  it('allows development and test', () => {
    expect(() => assertSeedAllowed('development')).not.toThrow()
    expect(() => assertSeedAllowed('test')).not.toThrow()
  })
})
