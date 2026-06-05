import type { Job } from 'bullmq'

export type DeliveryJobData = {
  deliveryId: string
}

export async function processor(_job: Job<DeliveryJobData>): Promise<void> {
  // Outbound delivery logic is wired in the delivery pipeline.
}
