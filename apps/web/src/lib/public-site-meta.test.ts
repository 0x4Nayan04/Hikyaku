import { describe, expect, it } from 'vitest'
import { applyPublicSiteMeta, normalizeSiteUrl } from './public-site-meta'

const shell = `<meta property="og:type" content="website" />
    <meta property="og:image" content="/og.png" />
    <meta name="twitter:image" content="/og.png" />`

describe('normalizeSiteUrl', () => {
  it('trims and strips a trailing slash', () => {
    expect(normalizeSiteUrl(' https://hikyaku.nayanswarnkar.com/ ')).toBe(
      'https://hikyaku.nayanswarnkar.com',
    )
    expect(normalizeSiteUrl(undefined)).toBe('')
    expect(normalizeSiteUrl('')).toBe('')
  })
})

describe('applyPublicSiteMeta', () => {
  it('leaves relative image URLs when the public origin is unset', () => {
    expect(applyPublicSiteMeta(shell, '')).toBe(shell)
  })

  it('absolutizes images and adds og:url plus canonical', () => {
    const next = applyPublicSiteMeta(shell, 'https://hikyaku.nayanswarnkar.com')
    expect(next).toContain('content="https://hikyaku.nayanswarnkar.com/og.png"')
    expect(next).not.toContain('content="/og.png"')
    expect(next).toContain('<meta property="og:url" content="https://hikyaku.nayanswarnkar.com/" />')
    expect(next).toContain('<link rel="canonical" href="https://hikyaku.nayanswarnkar.com/" />')
  })
})
