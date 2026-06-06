const SWEEP_INTERVAL_MS = 5 * 60 * 1000

let sweepTimer: ReturnType<typeof setInterval> | undefined

export async function sweepOrphanDeliveries(): Promise<void> {}

export function startSweeper(): void {
  void sweepOrphanDeliveries()

  sweepTimer = setInterval(() => {
    void sweepOrphanDeliveries()
  }, SWEEP_INTERVAL_MS)
}

export function stopSweeper(): void {
  if (sweepTimer !== undefined) {
    clearInterval(sweepTimer)
    sweepTimer = undefined
  }
}
