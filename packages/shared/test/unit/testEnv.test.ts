import { describe, expect, it } from 'vitest'
import { configureTestEnvironment } from '../../src/testEnv.js'

const valid = () => ({ TEST_DATABASE_URL: 'postgresql://test:test@localhost:5544/hikyaku_test', TEST_REDIS_URL: 'redis://localhost:6388/15', TEST_RUN_ID: 'test-run' })
describe('test connection guard', () => {
  it('refuses missing test targets and application defaults', () => {
    expect(() => configureTestEnvironment({})).toThrow('Tests require')
    expect(() => configureTestEnvironment({ ...valid(), DATABASE_URL: 'postgresql://localhost/webhooks' })).toThrow('Remove application')
    expect(() => configureTestEnvironment({ ...valid(), TEST_DATABASE_URL: 'postgresql://localhost/webhooks' })).toThrow('must end')
    expect(() => configureTestEnvironment({ ...valid(), TEST_REDIS_URL: 'redis://localhost:6379' })).toThrow('dedicated Redis')
  })
  it('sets only explicitly provided test connections', () => {
    const env: NodeJS.ProcessEnv = valid()
    configureTestEnvironment(env)
    expect(env.DATABASE_URL).toBe(env.TEST_DATABASE_URL)
    expect(env.REDIS_URL).toBe(env.TEST_REDIS_URL)
    expect(env.NODE_ENV).toBe('test')
  })
})
