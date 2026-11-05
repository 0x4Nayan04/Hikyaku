// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SecretOnceDialog } from '@/components/ui/secret-once-dialog'
import { SecretEndpointDialog } from '@/pages/endpoints/SecretEndpointDialog'
import { SettingsApiKeyDialogs } from '@/pages/settings/SettingsApiKeyDialogs'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement
let root: Root
const onClose = vi.fn()

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  onClose.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderDialog(secret: string | null, open = true) {
  await act(async () =>
    root.render(
      <SecretOnceDialog open={open} secret={secret} onClose={onClose} downloadFilename="secret.txt">
        <DialogHeader>
          <DialogTitle>Save your secret</DialogTitle>
          <DialogDescription>Keep this value safe.</DialogDescription>
        </DialogHeader>
      </SecretOnceDialog>,
    ),
  )
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll('button')).find(
    (item) => item.textContent === label,
  )
  if (!found) throw new Error(`Missing ${label} button`)
  return found
}

async function confirm() {
  await act(async () =>
    (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click(),
  )
}

async function escape() {
  await act(async () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    ),
  )
}

describe('secret-once dialog lifecycle', () => {
  it('blocks Escape and outside click until confirmation, then permits closing', async () => {
    await renderDialog('secret-a')
    expect(button('Done').disabled).toBe(true)
    await escape()
    await act(async () =>
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
        }),
      ),
    )
    await act(async () => document.body.click())
    expect(onClose).not.toHaveBeenCalled()
    await confirm()
    expect(button('Done').disabled).toBe(false)
    await act(async () =>
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
        }),
      ),
    )
    await act(async () => document.body.click())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('requires fresh confirmation after a different secret or reopening', async () => {
    await renderDialog('secret-a')
    await confirm()
    await renderDialog('secret-b')
    expect(button('Done').disabled).toBe(true)
    await escape()
    expect(onClose).not.toHaveBeenCalled()
    await confirm()
    await renderDialog('secret-b', false)
    await renderDialog('secret-b')
    expect(button('Done').disabled).toBe(true)
  })

  it('allows Done for the invite-dialog null-link fallback', async () => {
    await renderDialog(null)
    expect(document.querySelector('input[type="checkbox"]')).toBeNull()
    await act(async () => button('Done').click())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('downloads the current value without treating download as confirmation', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:secret')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('secret.txt')
      expect(this.href).toBe('blob:secret')
    })
    await renderDialog('secret-current')
    await act(async () => button('Download').click())
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:secret')
    expect(button('Done').disabled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each(['endpoint', 'api-key', 'invite'])('retains confirmation wiring for %s', async (kind) => {
    await act(async () =>
      root.render(
        kind === 'endpoint' ? (
          <SecretEndpointDialog
            secretEndpoint={{
              id: 'endpoint-a',
              url: 'https://example.com',
              status: 'active',
              description: null,
              created_at: '2026-11-05T00:00:00Z',
              secret: 'endpoint-secret',
            }}
            onSecretEndpointChange={onClose}
          />
        ) : kind === 'api-key' ? (
          <SettingsApiKeyDialogs
            secretKey={{
              id: 'key-a',
              prefix: 'hk_test',
              created_at: '2026-11-05T00:00:00Z',
              last_used_at: null,
              revoked_at: null,
              api_key: 'api-key-secret',
            }}
            revokeTarget={null}
            revokingId={null}
            onSecretKeyChange={onClose}
            onRevokeTargetChange={vi.fn()}
            onRevoke={vi.fn()}
          />
        ) : (
          <InviteUrlDialog
            open
            inviteUrl="https://example.com/invite?token=one"
            expiresAt={null}
            onOpenChange={onClose}
          />
        ),
      ),
    )
    await escape()
    expect(onClose).not.toHaveBeenCalled()
    expect(button('Done').disabled).toBe(true)
    await confirm()
    await act(async () => button('Done').click())
    expect(onClose).toHaveBeenCalledWith(kind === 'invite' ? false : null)
  })
})
