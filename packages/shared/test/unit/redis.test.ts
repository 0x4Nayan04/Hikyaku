import { describe, expect, it } from 'vitest'
import { redisConnectionOptions } from '../../src/redis.js'

describe('redisConnectionOptions', () => {
  it('enables dual-stack lookup and keeps the database index', () => {
    expect(redisConnectionOptions('redis://localhost:6388/15', null)).toEqual({
      family: 0,
      host: 'localhost',
      port: 6388,
      username: undefined,
      password: undefined,
      db: 15,
      maxRetriesPerRequest: null,
    })
  })

  it('parses Railway credentials and TLS', () => {
    expect(
      redisConnectionOptions('rediss://default:p%40ss@redis.railway.internal:6379', 1),
    ).toEqual({
      family: 0,
      host: 'redis.railway.internal',
      port: 6379,
      username: 'default',
      password: 'p@ss',
      maxRetriesPerRequest: 1,
      tls: {},
    })
  })
})
