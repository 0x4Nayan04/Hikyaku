import { describe, expect, it } from 'vitest'
import { checkWebhookUrl, isPrivateIp } from '../../src/webhookUrl.js'

describe('isPrivateIp', () => {
  it('flags common private and loopback IPv4 ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true)
    expect(isPrivateIp('10.0.0.1')).toBe(true)
    expect(isPrivateIp('192.168.1.1')).toBe(true)
    expect(isPrivateIp('172.16.0.1')).toBe(true)
    expect(isPrivateIp('169.254.1.1')).toBe(true)
    expect(isPrivateIp('8.8.8.8')).toBe(false)
  })

  it('flags loopback and unique-local IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true)
    expect(isPrivateIp('fc00::1')).toBe(true)
    expect(isPrivateIp('fe80::1')).toBe(true)
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false)
  })
})

describe('checkWebhookUrl', () => {
  it('rejects localhost and literal private IPs', async () => {
    await expect(checkWebhookUrl('http://localhost/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://127.0.0.1/hook')).resolves.toMatchObject({ ok: false })
    await expect(checkWebhookUrl('http://192.168.0.10/hook')).resolves.toMatchObject({ ok: false })
  })

  it('rejects credentials and non-http schemes', async () => {
    await expect(checkWebhookUrl('https://user:pass@example.com/hook')).resolves.toMatchObject({
      ok: false,
    })
    await expect(checkWebhookUrl('ftp://example.com/hook')).resolves.toMatchObject({ ok: false })
  })

  it('allows private targets when allowPrivate is set', async () => {
    await expect(
      checkWebhookUrl('http://127.0.0.1/hook', { allowPrivate: true }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepts a public https URL', async () => {
    await expect(checkWebhookUrl('https://example.com/hook')).resolves.toEqual({ ok: true })
  })
})
