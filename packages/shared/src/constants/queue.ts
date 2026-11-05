export function queueName(): string {
  return typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'test' &&
    process.env.TEST_RUN_ID
    ? `webhook-deliveries-test-${process.env.TEST_RUN_ID}`
    : 'webhook-deliveries'
}

export const JOB_NAME = 'deliver'

export type DeliveryJobData = {
  deliveryId: string
  tenantId: string
  replayCount: number
}

export const DELIVERY_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 3600, count: 1000 },
}
