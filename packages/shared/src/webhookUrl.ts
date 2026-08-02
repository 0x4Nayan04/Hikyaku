import type { LookupAddress } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

export type WebhookUrlCheck = { ok: true } | { ok: false; reason: string }
type ResolvedWebhookUrlCheck =
  | { ok: true; url: URL; addresses: LookupAddress[] }
  | { ok: false; reason: string }

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])
const BLOCKED_IPS = new BlockList()

BLOCKED_IPS.addSubnet('0.0.0.0', 8, 'ipv4')
BLOCKED_IPS.addSubnet('10.0.0.0', 8, 'ipv4')
BLOCKED_IPS.addSubnet('100.64.0.0', 10, 'ipv4')
BLOCKED_IPS.addSubnet('127.0.0.0', 8, 'ipv4')
BLOCKED_IPS.addSubnet('169.254.0.0', 16, 'ipv4')
BLOCKED_IPS.addSubnet('172.16.0.0', 12, 'ipv4')
BLOCKED_IPS.addSubnet('192.0.0.0', 24, 'ipv4')
BLOCKED_IPS.addSubnet('192.0.2.0', 24, 'ipv4')
BLOCKED_IPS.addSubnet('192.88.99.0', 24, 'ipv4')
BLOCKED_IPS.addSubnet('192.168.0.0', 16, 'ipv4')
BLOCKED_IPS.addSubnet('198.18.0.0', 15, 'ipv4')
BLOCKED_IPS.addSubnet('198.51.100.0', 24, 'ipv4')
BLOCKED_IPS.addSubnet('203.0.113.0', 24, 'ipv4')
BLOCKED_IPS.addSubnet('224.0.0.0', 4, 'ipv4')
BLOCKED_IPS.addSubnet('240.0.0.0', 4, 'ipv4')
BLOCKED_IPS.addAddress('::', 'ipv6')
BLOCKED_IPS.addAddress('::1', 'ipv6')
BLOCKED_IPS.addSubnet('fc00::', 7, 'ipv6')
BLOCKED_IPS.addSubnet('fe80::', 10, 'ipv6')
BLOCKED_IPS.addSubnet('fec0::', 10, 'ipv6')
BLOCKED_IPS.addSubnet('ff00::', 8, 'ipv6')
BLOCKED_IPS.addSubnet('64:ff9b::', 96, 'ipv6')
BLOCKED_IPS.addSubnet('64:ff9b:1::', 48, 'ipv6')
BLOCKED_IPS.addSubnet('100::', 64, 'ipv6')
BLOCKED_IPS.addSubnet('100:0:0:1::', 64, 'ipv6')
BLOCKED_IPS.addSubnet('2001::', 23, 'ipv6')
BLOCKED_IPS.addSubnet('2001:db8::', 32, 'ipv6')
BLOCKED_IPS.addSubnet('2002::', 16, 'ipv6')
BLOCKED_IPS.addSubnet('3fff::', 20, 'ipv6')
BLOCKED_IPS.addSubnet('5f00::', 16, 'ipv6')

function stripBrackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1)
  }
  return hostname
}

/** Returns true for loopback, link-local, private, and CGNAT addresses. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  return version !== 0 && BLOCKED_IPS.check(ip, version === 4 ? 'ipv4' : 'ipv6')
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) return true
  if (isIP(host) && isPrivateIp(host)) return true
  return false
}

/** Resolves and validates every address so the caller can pin the connection to this result. */
export async function resolveWebhookUrl(
  raw: string,
  allowPrivate = false,
): Promise<ResolvedWebhookUrlCheck> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'URL must use http or https' }
  }

  // Production (allowPrivate=false) requires HTTPS so payloads and signatures are not MITM'd.
  if (!allowPrivate && url.protocol !== 'https:') {
    return { ok: false, reason: 'URL must use https' }
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'URL must not include credentials' }
  }

  const host = stripBrackets(url.hostname)
  if (!allowPrivate && isBlockedHostname(host)) {
    return { ok: false, reason: 'URL must not target a private or loopback address' }
  }

  try {
    const records = await lookup(host, { all: true, verbatim: true })
    for (const record of records) {
      if (!allowPrivate && isPrivateIp(record.address)) {
        return { ok: false, reason: 'URL must not target a private or loopback address' }
      }
    }
    return { ok: true, url, addresses: records }
  } catch {
    return { ok: false, reason: 'URL hostname could not be resolved' }
  }
}

/** Rejects non-http(s) URLs and targets that resolve to private/loopback addresses. */
export async function checkWebhookUrl(
  raw: string,
  allowPrivate = false,
): Promise<WebhookUrlCheck> {
  const result = await resolveWebhookUrl(raw, allowPrivate)
  return result.ok ? { ok: true } : result
}
