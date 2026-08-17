import { describe, expect, it } from 'vitest'
import { titleForPath } from './page-title'

describe('titleForPath', () => {
  it('maps known routes', () => {
    expect(titleForPath('/')).toBe('Hikyaku')
    expect(titleForPath('/why-haiku')).toBe('Why Haiku · Hikyaku')
    expect(titleForPath('/login')).toBe('Sign in · Hikyaku')
    expect(titleForPath('/docs')).toBe('Hikyaku Docs')
    expect(titleForPath('/docs', '#signing')).toBe('Signing · Hikyaku Docs')
    expect(titleForPath('/docs/anything')).toBe('Hikyaku Docs')
    expect(titleForPath('/dashboard')).toBe('Dashboard · Hikyaku')
    expect(titleForPath('/events/send')).toBe('Test event · Hikyaku')
    expect(titleForPath('/events/abc')).toBe('Event · Hikyaku')
    expect(titleForPath('/deliveries/abc')).toBe('Delivery · Hikyaku')
    expect(titleForPath('/admin/tenants/t1')).toBe('Tenant · Hikyaku')
    expect(titleForPath('/this-does-not-exist')).toBe('Not found · Hikyaku')
  })
})
