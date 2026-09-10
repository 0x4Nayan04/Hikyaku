import type { EndpointJson, EndpointWithSecretJson } from '@webhook/shared/apiJson'
import type { DeliveryStatus, EndpointStatus } from '@webhook/shared/constants'

export type EndpointRow = {
  id: string
  url: string
  status: EndpointStatus
  description: string | null
  createdAt: Date
}

export type EndpointLastDeliveryRow = {
  id: string
  status: DeliveryStatus
  updatedAt: Date
  lastError: string | null
}

export function toEndpointJson(
  row: EndpointRow,
  secret?: string,
  lastDelivery?: EndpointLastDeliveryRow | null,
): EndpointJson | EndpointWithSecretJson {
  const body = {
    id: row.id,
    url: row.url,
    status: row.status,
    description: row.description,
    created_at: row.createdAt.toISOString(),
    ...(lastDelivery !== undefined
      ? {
          last_delivery:
            lastDelivery === null
              ? null
              : {
                  id: lastDelivery.id,
                  status: lastDelivery.status,
                  updated_at: lastDelivery.updatedAt.toISOString(),
                  last_error: lastDelivery.lastError,
                },
        }
      : {}),
  }

  return secret === undefined ? body : { ...body, secret }
}
