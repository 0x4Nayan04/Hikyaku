import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './client'

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
