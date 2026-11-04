import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  sessionApiFetch,
  getStats,
  listApiKeys,
  listEvents,
  getAdminTenant,
  getMe,
  logout,
} from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mock401(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code, message: 'Request failed' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('explicit session request auth redirects', () => {
  it('does not redirect for invalid credentials', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    mock401('invalid_credentials')

    await expect(apiFetch('/test')).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('redirects when the session is unauthorized', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', {
      location: {
        assign,
        pathname: '/deliveries',
        search: '?status=failed',
        hash: '#attempts',
      },
    })
    mock401('unauthorized')

    await expect(sessionApiFetch('/test')).rejects.toMatchObject({ code: 'unauthorized' })
    expect(assign).toHaveBeenCalledWith(
      '/login?returnTo=%2Fdeliveries%3Fstatus%3Dfailed%23attempts',
    )
  })
})

describe('list requests', () => {
  it('forwards an abort signal to the network request', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], has_more: false, limit: 25, offset: 0 })),
      )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    await listEvents({ limit: 25 }, { signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/events?limit=25',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('forwards an abort signal to the API-key list request', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], has_more: false, limit: 25, offset: 0 })),
      )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    await listApiKeys({ limit: 25, offset: 25 }, { signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/api-keys?limit=25&offset=25',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('forwards an abort signal to the stats request', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          events_today: 0,
          deliveries_active: 0,
          deliveries_succeeded_24h: 0,
          deliveries_failed_24h: 0,
          success_rate_24h: null,
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    await getStats({ signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/stats',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})

describe('response and header contracts', () => {
  it('keeps raw transport free of navigation side effects', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    mock401('unauthorized')
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 401 })
    expect(assign).not.toHaveBeenCalled()
  })

  it.each([new Headers({ 'X-Test': 'value' }), [['X-Test', 'value']] as [string, string][]])(
    'normalizes HeadersInit without losing supplied headers',
    async (headers) => {
      const fetch = vi.fn().mockResolvedValue(new Response('{}'))
      vi.stubGlobal('fetch', fetch)
      await apiFetch('/test', { headers })
      const sent = fetch.mock.calls[0][1].headers as Headers
      expect(sent.get('X-Test')).toBe('value')
      expect(sent.get('Content-Type')).toBe('application/json')
    },
  )

  it('rejects an empty response when JSON was promised', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(apiFetch('/test')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('accepts the explicitly bodyless logout response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(logout()).resolves.toBeUndefined()
  })

  it('does not trust non-string server error fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: 123, message: { text: 'unsafe' } } }), {
            status: 400,
            statusText: 'Bad request',
          }),
        ),
    )
    await expect(apiFetch('/test')).rejects.toMatchObject({
      code: 'unknown',
      message: 'Bad request',
    })
  })

  it('forwards cancellation to admin details and session probes', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    await getAdminTenant('tenant-1', { signal })
    await getMe({ signal })
    expect(fetch.mock.calls.map((call) => call[1].signal)).toEqual([signal, signal])
  })
})
