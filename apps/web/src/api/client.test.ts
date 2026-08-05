import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, listApiKeys, listEvents } from './client'

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

describe('apiFetch auth redirects', () => {
  it('does not redirect for invalid credentials', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    mock401('invalid_credentials')

    await expect(apiFetch('/test')).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('redirects when the session is unauthorized', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    mock401('unauthorized')

    await expect(apiFetch('/test')).rejects.toMatchObject({ code: 'unauthorized' })
    expect(assign).toHaveBeenCalledWith('/login')
  })
})

describe('list requests', () => {
  it('forwards an abort signal to the network request', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], total: 0, limit: 25, offset: 0 })),
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
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], total: 0, limit: 25, offset: 0 })),
    )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    await listApiKeys({ limit: 25, offset: 25 }, { signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/api-keys?limit=25&offset=25',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})
