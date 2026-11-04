import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './lib/logger.js'
import { startWorker } from './runtime.js'

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = startWorker()

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void runtime
        .shutdown(signal)
        .then((code) => process.exit(code))
        .catch((err) => {
          logger.fatal({ err }, 'shutdown_failed')
          process.exit(1)
        })
    })
  }

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled_rejection')
    process.exit(1)
  })

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception')
    process.exit(1)
  })
}
