import { describe, expect, it, vi } from 'vitest'
import { checkWebhookUrl, isPrivateIp, resolveWebhookUrl } from '../../src/webhookUrl.js'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => [
    { address: host === '127.0.0.1' ? host : '93.184.216.34', family: 4 },
  ]),
}))

describe('isPrivateIp', () => {
  it('flags common private and loopback IPv4 ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true)
    expect(isPrivateIp('10.0.0.1')).toBe(true)
    expect(isPrivateIp('192.168.1.1')).toBe(true)
    expect(isPrivateIp('172.16.0.1')).toBe(true)
    expect(isPrivateIp('169.254.1.1')).toBe(true)
    expect(isPrivateIp('8.8.8.8')).toBe(false)
  })

  it('flags reserved, benchmarking, documentation, and multicast IPv4 ranges', () => {
    expect(isPrivateIp('192.0.0.1')).toBe(true)
    expect(isPrivateIp('192.0.2.1')).toBe(true)
    expect(isPrivateIp('192.88.99.1')).toBe(true)
    expect(isPrivateIp('198.18.0.1')).toBe(true)
    expect(isPrivateIp('198.51.100.1')).toBe(true)
    expect(isPrivateIp('203.0.113.1')).toBe(true)
    expect(isPrivateIp('224.0.0.1')).toBe(true)
    expect(isPrivateIp('240.0.0.1')).toBe(true)
  })

  it('flags loopback and unique-local IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true)
    expect(isPrivateIp('fc00::1')).toBe(true)
    expect(isPrivateIp('fe80::1')).toBe(true)
    expect(isPrivateIp('::ffff:7f00:1')).toBe(true)
    expect(isPrivateIp('64:ff9b::192.0.2.1')).toBe(true)
    expect(isPrivateIp('2002:c000:0204::')).toBe(true)
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false)
  })

  it('flags reserved and multicast IPv6 ranges', () => {
    expect(isPrivateIp('ff02::1')).toBe(true)
    expect(isPrivateIp('fec0::1')).toBe(true)
    expect(isPrivateIp('100::1')).toBe(true)
    expect(isPrivateIp('100:0:0:1::1')).toBe(true)
    expect(isPrivateIp('2001:db8::1')).toBe(true)
    expect(isPrivateIp('3fff::1')).toBe(true)
    expect(isPrivateIp('5f00::1')).toBe(true)
  })
})

describe('checkWebhookUrl', () => {
  it('rejects localhost and literal private IPs', async () => {
    await expect(checkWebhookUrl('http://localhost/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://127.0.0.1/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://192.168.0.10/hook')).resolves.toMatchObject({ ok: false })
  })

  it('rejects literal non-public and multicast IPs', async () => {
    await expect(checkWebhookUrl('http://198.18.0.1/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://224.0.0.1/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://[ff02::1]/hook')).resolves.toMatchObject({ ok: false })
  })

  it('rejects credentials and non-http schemes', async () => {
    await expect(checkWebhookUrl('https://user:pass@example.com/hook')).resolves.toMatchObject({
      ok: false,
    })
    await expect(checkWebhookUrl('ftp://example.com/hook')).resolves.toMatchObject({ ok: false })
  })

  it('rejects plain http when private targets are not allowed', async () => {
    await expect(checkWebhookUrl('http://example.com/hook')).resolves.toMatchObject({
      ok: false,
      reason: 'URL must use https',
    })
  })

  it('allows private targets when allowPrivate is set', async () => {
    await expect(checkWebhookUrl('http://127.0.0.1/hook', true)).resolves.toEqual({ ok: true })
  })

  it('accepts a public https URL', async () => {
    await expect(checkWebhookUrl('https://example.com/hook')).resolves.toEqual({ ok: true })
  })

  it('returns only validated public addresses for connection pinning', async () => {
    const result = await resolveWebhookUrl('https://example.com/hook')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.url.hostname).toBe('example.com')
    expect(result.addresses.length).toBeGreaterThan(0)
    expect(result.addresses.every((address) => !isPrivateIp(address.address))).toBe(true)
  })
})
