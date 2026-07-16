import type { Server } from 'node:http'
import { env } from './config.js'
import { closePool } from './db/client.js'
import { logger } from './lib/logger.js'
import { closeRedis } from './lib/redis.js'
import { createApp } from './server.js'

const SHUTDOWN_TIMEOUT_MS = 25_000
let shuttingDown = false

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

async function shutdown(server: Server, signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'shutting_down')

  await Promise.race([
    closeServer(server),
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('shutdown_timeout')), SHUTDOWN_TIMEOUT_MS)
    }),
  ]).catch((err) => {
    logger.warn({ err }, 'shutdown_forced')
  })

  await closePool()
  await closeRedis()
  logger.info('shutdown_complete')
  process.exit(0)
}

const app = createApp()
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'server_started')
})

process.on('SIGTERM', () => {
  void shutdown(server, 'SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown(server, 'SIGINT')
})
