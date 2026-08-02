import type { LookupAddress } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import { resolveWebhookUrl } from '@webhook/shared/webhookUrl'

const MAX_REDIRECTS = 5
const MAX_RESPONSE_BODY_BYTES = 1024

type PinnedTarget = { url: URL; addresses: LookupAddress[] }

function pinnedLookup(addresses: LookupAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, addresses)
      return
    }
    const address = addresses[0]
    if (!address) {
      callback(new Error('URL hostname could not be resolved'), '')
      return
    }
    callback(null, address.address, address.family)
  }
}

function requestOnce(
  target: PinnedTarget,
  body: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ status: number; body: string; location?: string }> {
  return new Promise((resolve, reject) => {
    const request = target.url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(
      target.url,
      {
        method: 'POST',
        headers,
        lookup: pinnedLookup(target.addresses),
        signal,
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = []
        let length = 0
        let settled = false

        const finish = () => {
          if (settled) return
          settled = true
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            location: res.headers.location,
          })
        }

        res.on('data', (chunk: Buffer) => {
          if (settled) return
          const remaining = MAX_RESPONSE_BODY_BYTES - length
          if (remaining <= 0) {
            res.destroy()
            return
          }
          const slice = chunk.subarray(0, remaining)
          chunks.push(slice)
          length += slice.length
          if (length >= MAX_RESPONSE_BODY_BYTES) {
            res.destroy()
          }
        })
        res.on('end', finish)
        res.on('close', finish)
        res.on('error', (err) => {
          // destroy() after the 1KB cap can surface as an error; keep the truncated body.
          if (length > 0) finish()
          else reject(err)
        })
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}

export async function postWithTimeout(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
  allowPrivate = false,
): Promise<{ status: number; body: string; durationMs: number }> {
  const start = Date.now()
  const signal = AbortSignal.timeout(timeoutMs)
  let currentUrl = url

  for (let redirects = 0; ; redirects += 1) {
    const target = await resolveWebhookUrl(currentUrl, allowPrivate)
    if (!target.ok) {
      throw new Error(`blocked_url: ${target.reason}`)
    }

    const result = await requestOnce(target, body, headers, signal)
    if (result.status < 300 || result.status >= 400 || !result.location) {
      return { status: result.status, body: result.body, durationMs: Date.now() - start }
    }
    if (redirects >= MAX_REDIRECTS) {
      throw new Error('too_many_redirects')
    }
    currentUrl = new URL(result.location, target.url).toString()
  }
}
