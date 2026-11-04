import { startApi } from './runtime.js'
import { logger } from './lib/logger.js'

const { shutdown } = startApi()
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .then((code) => process.exit(code))
      .catch((err) => {
        logger.fatal({ err }, 'shutdown_failed')
        process.exit(1)
      })
  })
}
