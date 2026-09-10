/** Explicit test targets only. Never infer test resources from application defaults. */
export function configureTestEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const database = env.TEST_DATABASE_URL
  const redis = env.TEST_REDIS_URL
  const run = env.TEST_RUN_ID
  if (!database || !redis || !run || !/^[a-zA-Z0-9_-]+$/.test(run)) {
    throw new Error('Tests require TEST_DATABASE_URL, TEST_REDIS_URL and an alphanumeric TEST_RUN_ID. Development .env is never used.')
  }
  const dbUrl = new URL(database)
  const redisUrl = new URL(redis)
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol) || !dbUrl.pathname.endsWith('_test')) {
    throw new Error('Test database name must end in _test')
  }
  if (!['redis:', 'rediss:'].includes(redisUrl.protocol) || !/^\/[1-9]\d*$/.test(redisUrl.pathname)) {
    throw new Error('Tests require a dedicated Redis database number greater than zero')
  }
  if (env.DATABASE_URL && env.DATABASE_URL !== database || env.REDIS_URL && env.REDIS_URL !== redis) {
    throw new Error('Remove application DATABASE_URL/REDIS_URL before running tests; only explicit test connections are accepted')
  }
  env.NODE_ENV = 'test'
  env.DATABASE_URL = database
  env.REDIS_URL = redis
}
