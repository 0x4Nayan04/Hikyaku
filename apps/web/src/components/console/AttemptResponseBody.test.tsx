import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AttemptResponseBody } from '@/components/console/AttemptResponseBody'

describe('AttemptResponseBody', () => {
  it('renders the raw response in a pre with a copy button', () => {
    const body = '{"nested":"{\\"ok\\":true}"}'
    const markup = renderToStaticMarkup(<AttemptResponseBody body={body} />)

    expect(markup).toContain('<pre')
    expect(markup).toContain('{&quot;nested&quot;:&quot;{\\&quot;ok\\&quot;:true}&quot;}')
    expect(markup).toContain('>Copy</span>')
    expect(markup).not.toContain('Formatted')
  })
})
