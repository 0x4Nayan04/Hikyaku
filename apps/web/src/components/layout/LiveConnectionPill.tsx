import type { DeliveryConnectionMode } from '@/hooks/useDeliveryLiveUpdates'
import { LiveChip } from '@/components/console/LiveChip'

type LiveConnectionPillProps = {
  mode: DeliveryConnectionMode
}

export function LiveConnectionPill({ mode }: LiveConnectionPillProps) {
  const isLive = mode === 'sse' || mode === 'polling'
  if (!isLive) return null
  return <LiveChip active />
}
