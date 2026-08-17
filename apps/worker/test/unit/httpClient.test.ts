import { createServer } from 'node:http'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWebhookUrl = vi.hoisted(() => vi.fn())

vi.mock('@webhook/shared/webhookUrl', () => ({ resolveWebhookUrl }))

import { postWithTimeout } from '../../src/httpClient.js'

beforeEach(() => {
  resolveWebhookUrl.mockReset()
})

describe('postWithTimeout DNS timeout', () => {
  it('times out while URL resolution is still pending', async () => {
    resolveWebhookUrl.mockReturnValue(new Promise(() => {}))

    const startedAt = Date.now()
    const error = await postWithTimeout('https://example.com/hook', '{}', {}, 30).catch(
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ name: 'AbortError' })
    expect(Date.now() - startedAt).toBeLessThan(250)
  })
})

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
  it('caps response body at 1KB instead of buffering the full response', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      const chunk = Buffer.alloc(64 * 1024, 0x61)
      let chunksSent = 0
      const write = () => {
        while (chunksSent < 32) {
          const ok = res.write(chunk)
          chunksSent += 1
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
      const result = await postWithTimeout('http://127.0.0.1/hook', '{}', {}, 5_000, true)
      expect(result.status).toBe(200)
      expect(Buffer.byteLength(result.body, 'utf8')).toBeLessThanOrEqual(1024)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })

  it('reuses the TCP socket after truncating a large response', async () => {
    let connections = 0
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(Buffer.alloc(8 * 1024, 0x61))
    })
    server.on('connection', () => {
      connections += 1
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
      await postWithTimeout('http://127.0.0.1/hook', '{}', {}, 5_000, true)
      await postWithTimeout('http://127.0.0.1/hook', '{}', {}, 5_000, true)
      expect(connections).toBe(1)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })
})
