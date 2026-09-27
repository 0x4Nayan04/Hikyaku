import { describe, expect, it } from 'vitest'
import { PROXY_PATH_PARAM, upstreamTarget } from '../../../src/lib/proxyUpstream.js'

const upstream = 'https://api.up.railway.app/'

describe('upstreamTarget', () => {
  it('maps the Vercel proxy path onto the API', () => {
    expect(upstreamTarget(upstream, '/api/proxy/health')).toBe(
      'https://api.up.railway.app/v1/health',
    )
    expect(upstreamTarget(upstream, '/api/proxy/events?limit=25')).toBe(
      'https://api.up.railway.app/v1/events?limit=25',
    )
    expect(upstreamTarget(upstream, '/api/proxy/deliveries/abc')).toBe(
      'https://api.up.railway.app/v1/deliveries/abc',
    )
  })

  it('reads the rewritten path param and keeps the original query', () => {
    expect(
      upstreamTarget(upstream, `/api/proxy?${PROXY_PATH_PARAM}=deliveries%2Fabc&limit=25`),
    ).toBe('https://api.up.railway.app/v1/deliveries/abc?limit=25')
    expect(upstreamTarget(upstream, `/api/proxy?${PROXY_PATH_PARAM}=`)).toBe(
      'https://api.up.railway.app/v1',
    )
  })

  it('accepts an already-prefixed /v1 path', () => {
    expect(upstreamTarget('https://api.example.com', '/v1/ready')).toBe(
      'https://api.example.com/v1/ready',
    )
  })
})
