import '../../src/config.js'
import { closeRedis, getRedis } from '../../../api/src/lib/redis.js'

// Only this run's request counters; other runs and the application are untouched.
const redis = getRedis()
const keys = await redis.keys(`test-${process.env.TEST_RUN_ID}:*`)
if (keys.length) await redis.del(...keys)
await closeRedis()
