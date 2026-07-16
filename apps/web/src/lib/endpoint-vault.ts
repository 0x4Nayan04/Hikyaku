const vault = new Map<string, string>()

export function listEndpointSecrets(): Record<string, string> {
  return Object.fromEntries(vault)
}

export function saveEndpointSecret(endpointId: string, secret: string): void {
  vault.set(endpointId, secret)
}

export function removeEndpointSecret(endpointId: string): void {
  vault.delete(endpointId)
}
