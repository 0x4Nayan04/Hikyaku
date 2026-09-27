import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import {
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  upstreamTarget,
} from '../apps/api/src/lib/proxyUpstream.js'

const FORWARD_REQUEST_HEADERS = [
  'cookie',
  'content-type',
  'authorization',
  'origin',
  'accept',
  'x-admin-secret',
] as const

const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-request-id'] as const

export const config = {
  api: {
    bodyParser: false,
  },
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && value.length > 0) return value.join(', ')
  return undefined
}

function clientIp(req: IncomingMessage): string | undefined {
  const forwarded = headerValue(req, 'x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded && isIP(forwarded)) return forwarded
  const real = headerValue(req, 'x-real-ip')
  if (real && isIP(real)) return real
  return undefined
}

async function readBody(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return new Uint8Array(Buffer.concat(chunks))
}

function sendJson(res: ServerResponse, status: number, code: string, message: string): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ error: { code, message } }))
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const upstream = process.env.API_UPSTREAM_URL
  if (!upstream) {
    sendJson(res, 503, 'proxy_unconfigured', 'API_UPSTREAM_URL is not set')
    return
  }

  const method = (req.method ?? 'GET').toUpperCase()
  const headers = new Headers()
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = headerValue(req, name)
    if (value) headers.set(name, value)
  }

  const secret = process.env.PROXY_IP_SECRET
  const ip = clientIp(req)
  if (secret && ip) {
    headers.set(PROXY_SECRET_HEADER, secret)
    headers.set(PROXY_CLIENT_IP_HEADER, ip)
  }

  try {
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
    const upstreamRes = await fetch(upstreamTarget(upstream, req.url ?? '/'), {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined,
      redirect: 'manual',
    })

    res.statusCode = upstreamRes.status
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = upstreamRes.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    const setCookies = upstreamRes.headers.getSetCookie()
    if (setCookies.length > 0) res.setHeader('set-cookie', setCookies)
    res.end(Buffer.from(await upstreamRes.arrayBuffer()))
  } catch {
    sendJson(res, 502, 'proxy_unreachable', 'API upstream is unreachable')
  }
}
