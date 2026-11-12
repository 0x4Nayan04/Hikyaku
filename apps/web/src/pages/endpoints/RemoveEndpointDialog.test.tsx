// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { removeEndpoint } from '@/api/client'
import { RemoveEndpointDialog } from './RemoveEndpointDialog'

vi.mock('@/api/client', async (original) => ({
  ...(await original<typeof import('@/api/client')>()),
  removeEndpoint: vi.fn(),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn() } }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
const changed = vi.fn().mockResolvedValue(true)
const close = vi.fn()
const target = {
  id: 'endpoint-1',
  url: 'https://example.com/hook',
  status: 'active' as const,
  description: null,
  created_at: '2026-11-12T00:00:00Z',
}
async function render() {
  await act(async () =>
    root.render(
      <RemoveEndpointDialog target={target} onTargetChange={close} onChanged={changed} />,
    ),
  )
}
function button(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent === label,
  )!
}
beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
it('explains permanence and retained history before allowing cancellation', async () => {
  await render()
  expect(document.body.textContent).toContain('Delivery history is retained')
  expect(document.body.textContent).toContain('already claimed for sending may finish')
  await act(async () => button('Cancel').click())
  expect(close).toHaveBeenCalledWith(null)
  expect(removeEndpoint).not.toHaveBeenCalled()
})
it('blocks repeat removal and closing while pending, then refreshes after success', async () => {
  let finish!: () => void
  vi.mocked(removeEndpoint).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  await render()
  await act(async () => button('Remove permanently').click())
  expect(removeEndpoint).toHaveBeenCalledWith(target.id)
  expect(button('Removing…').disabled).toBe(true)
  expect(button('Cancel').disabled).toBe(true)
  expect(changed).not.toHaveBeenCalled()
  await act(async () => finish())
  expect(close).toHaveBeenCalledWith(null)
  expect(changed).toHaveBeenCalledTimes(1)
})
it('keeps the confirmation open with an error and permits retry', async () => {
  vi.mocked(removeEndpoint).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce()
  await render()
  await act(async () => button('Remove permanently').click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Try again')
  expect(close).not.toHaveBeenCalled()
  expect(changed).not.toHaveBeenCalled()
  await act(async () => button('Remove permanently').click())
  expect(changed).toHaveBeenCalledTimes(1)
})
