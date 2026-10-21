import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '@/lib/app-meta'
import { LandingFanout } from '@/components/landing/LandingFanout'

describe('LandingFanout', () => {
  it('renders the settled fan-out diagram with signed stamp, endpoints, and retry ledger', () => {
    const html = renderToStaticMarkup(<LandingFanout />)

    expect(html).toContain('role="img"')
    expect(html).toContain(
      `${APP_NAME} accepts order.paid, signs deliveries, delivers to three endpoints, and schedules a retry for a 429 in the ledger.`,
    )
    expect(html).toContain('order.paid')
    expect(html).toContain('signed')
    expect(html).toContain('billing.acme.dev')
    expect(html).toContain('hooks.crm.io')
    expect(html).toContain('notify.acme.dev')
    expect(html).toContain('429')
    expect(html).toContain('retrying')
    expect(html).toContain('attempt 2/5')
    expect(html).toContain('retry in 32s')
    expect(html).not.toContain('lp-fanout__packet')
    expect(html).not.toContain('animateMotion')
    expect(html).not.toContain('awaiting attempts')
    expect(html).not.toContain('is-inview')
    expect(html).not.toContain('is-signed')
    expect(html).not.toContain('is-logged')
  })
})
