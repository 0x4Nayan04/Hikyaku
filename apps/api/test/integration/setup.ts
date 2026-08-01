import '../../src/config.js'
import { getRedis } from '../../src/lib/redis.js'
import { beginDeliveryTestIsolation } from '../helpers/delivery.js'

await beginDeliveryTestIsolation()

const redis = getRedis()
const authRateLimitKeys = await redis.keys('auth:ratelimit:*')
if (authRateLimitKeys.length > 0) {
  await redis.del(...authRateLimitKeys)
}
