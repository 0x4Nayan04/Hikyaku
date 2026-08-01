import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'

const resolveWebhookUrl = vi.hoisted(() => vi.fn())

vi.mock('@webhook/shared/webhookUrl', () => ({ resolveWebhookUrl }))

import { postWithTimeout } from '../../src/httpClient.js'

describe('postWithTimeout SSRF protection', () => {
  let closeServer: (() => Promise<void>) | undefined

  afterAll(async () => {
    await closeServer?.()
  })

  it('validates a redirect before connecting to it', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(307, { Location: 'http://127.0.0.1/internal' })
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test server address')
    closeServer = () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))

    resolveWebhookUrl
      .mockResolvedValueOnce({
        ok: true,
        url: new URL(`http://public.example:${address.port}/hook`),
        addresses: [{ address: '127.0.0.1', family: 4 }],
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: 'URL must not target a private or loopback address',
      })

    await expect(postWithTimeout('http://public.example/hook', '{}', {}, 2_000)).rejects.toThrow(
      'blocked_url',
    )
    expect(resolveWebhookUrl).toHaveBeenCalledTimes(2)
  })
})

describe('postWithTimeout response body cap', () => {
  it('stops reading after 1KB instead of buffering the full response', async () => {
    let bytesSent = 0
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      const chunk = Buffer.alloc(64 * 1024, 0x61)
      const write = () => {
        while (bytesSent < 2 * 1024 * 1024) {
          const ok = res.write(chunk)
          bytesSent += chunk.length
          if (!ok) {
            res.once('drain', write)
            return
          }
        }
        res.end()
      }
      write()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test server address')

    resolveWebhookUrl.mockResolvedValue({
      ok: true,
      url: new URL(`http://127.0.0.1:${address.port}/hook`),
      addresses: [{ address: '127.0.0.1', family: 4 }],
    })

    try {
      const result = await postWithTimeout('http://127.0.0.1/hook', '{}', {}, 5_000, {
        allowPrivate: true,
      })
      expect(result.status).toBe(200)
      expect(Buffer.byteLength(result.body, 'utf8')).toBeLessThanOrEqual(1024)
      // Server should not have been able to push the full 2MB before we destroyed the socket.
      expect(bytesSent).toBeLessThan(2 * 1024 * 1024)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })
})
