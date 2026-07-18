import type { MeResponse } from '@/api/types'

/** True when the signed-in tenant cannot use console APIs. */
export function isTenantSuspended(
  session: Pick<MeResponse, 'tenant'> | null | undefined,
): boolean {
  return session?.tenant?.status === 'suspended'
}
