import { describe, expect, it } from 'vitest'
import { parseCorsOrigins } from '../../../src/lib/cors.js'

describe('parseCorsOrigins', () => {
  it('splits comma-separated origins and trims whitespace', () => {
    expect(parseCorsOrigins('http://localhost:5173, https://app.example.com')).toEqual([
      'http://localhost:5173',
      'https://app.example.com',
    ])
  })

  it('filters empty entries', () => {
    expect(parseCorsOrigins('http://localhost:5173,, ')).toEqual(['http://localhost:5173'])
  })
})
