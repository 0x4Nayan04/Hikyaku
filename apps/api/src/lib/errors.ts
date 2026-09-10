import { logger } from './logger.js'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export async function enqueueOr503(
  work: Promise<void>,
  extra: Record<string, unknown>,
  msg: string,
): Promise<void> {
  try {
    await work
  } catch (err) {
    logger.error({ ...extra, err }, msg)
    throw new AppError(503, 'service_unavailable', 'Service temporarily unavailable')
  }
}
