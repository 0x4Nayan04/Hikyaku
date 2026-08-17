import type { LookupAddress } from 'node:dns'
import { Agent as HttpAgent, request as httpRequest, type IncomingMessage } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import { resolveWebhookUrl } from '@webhook/shared/webhookUrl'

const MAX_REDIRECTS = 5
const MAX_RESPONSE_BODY_BYTES = 1024
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 64 })
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 64 })

type PinnedTarget = { url: URL; addresses: LookupAddress[] }

function timeoutError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

async function resolveWithTimeout(
  url: string,
  allowPrivate: boolean,
  timeoutMs: number,
): ReturnType<typeof resolveWebhookUrl> {
  if (timeoutMs <= 0) throw timeoutError()

  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      resolveWebhookUrl(url, allowPrivate),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError()), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

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
        agent: target.url.protocol === 'https:' ? httpsAgent : httpAgent,
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
          if (settled || length >= MAX_RESPONSE_BODY_BYTES) return
          const remaining = MAX_RESPONSE_BODY_BYTES - length
          const slice = remaining >= chunk.length ? chunk : chunk.subarray(0, remaining)
          chunks.push(slice)
          length += slice.length
        })
        res.on('end', finish)
        res.on('close', finish)
        res.on('error', (err) => {
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
    const remainingMs = Math.max(0, timeoutMs - (Date.now() - start))
    const target = await resolveWithTimeout(currentUrl, allowPrivate, remainingMs)
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
