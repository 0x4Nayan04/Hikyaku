import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPreview } from '@/components/landing/LandingPreview'

describe('LandingPreview', () => {
  it('serves WebP srcset with a PNG fallback', () => {
    const html = renderToStaticMarkup(<LandingPreview />)

    expect(html).toContain('type="image/webp"')
    expect(html).toContain('/landing/console-dashboard-800w.webp 800w')
    expect(html).toContain('/landing/console-dashboard.webp 1512w')
    expect(html).toContain('src="/landing/console-dashboard.png"')
    expect(html).toContain('/landing/console-deliveries-800w.webp 800w')
    expect(html).toContain('src="/landing/console-delivery-detail.png"')
    expect(html).toContain('(max-width: 900px) 100vw, 1512px')
  })
})
