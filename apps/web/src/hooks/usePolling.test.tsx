// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from '@/hooks/usePolling'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Props = {
  enabled?: boolean
  intervalMs?: number
  onPoll: () => void | Promise<void>
}

let container: HTMLDivElement
let root: Root
let calls: number

function Harness(props: Props) {
  usePolling(props)
  return null
}

async function renderHarness(props: Props) {
  await act(async () => {
    root.render(<Harness {...props} />)
  })
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
}

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  calls = 0
  setHidden(false)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
  vi.useRealTimers()
})

describe('usePolling', () => {
  it('polls on the configured interval', async () => {
    await renderHarness({ intervalMs: 100, onPoll: () => void calls++ })

    expect(calls).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(calls).toBe(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(calls).toBe(6)
  })

  it('does not run overlapping polls', async () => {
    let resolve!: () => void
    const gate = new Promise<void>((res) => {
      resolve = res
    })
    const started: number[] = []
    await renderHarness({
      intervalMs: 100,
      onPoll: () => {
        started.push(calls)
        return gate
      },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(started).toHaveLength(1)

    await act(async () => {
      resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(started).toHaveLength(2)
  })

  it('pauses while hidden and resumes when visible', async () => {
    await renderHarness({ intervalMs: 100, onPoll: () => void calls++ })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(calls).toBe(3)

    await act(async () => {
      setHidden(true)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const afterHide = calls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(calls).toBe(afterHide)

    await act(async () => {
      setHidden(false)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(calls).toBe(afterHide + 1)
  })

  it('does not poll while disabled', async () => {
    await renderHarness({ enabled: false, intervalMs: 100, onPoll: () => void calls++ })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(calls).toBe(0)
  })
})
