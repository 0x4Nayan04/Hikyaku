import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type WebhookUrlCheck = { ok: true } | { ok: false; reason: string }

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])

function stripBrackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1)
  }
  return hostname
}

function isPrivateV4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateV6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true

  const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped?.[1]) return isPrivateV4(mapped[1])

  return false
}

/** Returns true for loopback, link-local, private, and CGNAT addresses. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateV4(ip)
  if (version === 6) return isPrivateV6(ip)
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) return true
  if (isIP(host) && isPrivateIp(host)) return true
  return false
}

/**
 * Rejects non-http(s) URLs and targets that resolve to private/loopback addresses.
 * ponytail: no DNS-rebinding race lock — re-check at delivery time; upgrade to pin resolved IP if needed.
 */
export async function checkWebhookUrl(
  raw: string,
  options: { allowPrivate?: boolean } = {},
): Promise<WebhookUrlCheck> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'URL must use http or https' }
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'URL must not include credentials' }
  }

  if (options.allowPrivate) {
    return { ok: true }
  }

  const host = stripBrackets(url.hostname)
  if (isBlockedHostname(host)) {
    return { ok: false, reason: 'URL must not target a private or loopback address' }
  }

  try {
    const records = await lookup(host, { all: true, verbatim: true })
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return { ok: false, reason: 'URL must not target a private or loopback address' }
      }
    }
  } catch {
    return { ok: false, reason: 'URL hostname could not be resolved' }
  }

  return { ok: true }
}
