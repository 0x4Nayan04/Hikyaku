import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiveChip } from '@/components/console/LiveChip'
import { POLL_DEFAULT_MS, POLL_FAST_MS, POLL_SLOW_MS } from '@/lib/ui-timing'

describe('LiveChip', () => {
  it('defaults to a 10s refresh hint', () => {
    const html = renderToStaticMarkup(<LiveChip />)
    expect(html).toContain(
      `Auto-refreshes about every ${POLL_DEFAULT_MS / 1000}s while this page is open.`,
    )
  })

  it('uses the interval passed by the page', () => {
    expect(renderToStaticMarkup(<LiveChip intervalMs={POLL_FAST_MS} />)).toContain(
      'Auto-refreshes about every 5s while this page is open.',
    )
    expect(renderToStaticMarkup(<LiveChip intervalMs={POLL_SLOW_MS} />)).toContain(
      'Auto-refreshes about every 15s while this page is open.',
    )
  })
})
