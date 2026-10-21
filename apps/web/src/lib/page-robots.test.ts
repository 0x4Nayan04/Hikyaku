import { describe, expect, it } from 'vitest'
import { robotsForPath } from './page-robots'

describe('robotsForPath', () => {
  it('indexes public marketing routes', () => {
    expect(robotsForPath('/')).toBe('index,follow')
    expect(robotsForPath('/docs')).toBe('index,follow')
    expect(robotsForPath('/docs/quick-start')).toBe('index,follow')
    expect(robotsForPath('/why-hikyaku')).toBe('index,follow')
    expect(robotsForPath('/why-haiku')).toBe('index,follow')
  })

  it('noindexes console, auth, and unknown routes', () => {
    expect(robotsForPath('/login')).toBe('noindex,nofollow')
    expect(robotsForPath('/bootstrap')).toBe('noindex,nofollow')
    expect(robotsForPath('/dashboard')).toBe('noindex,nofollow')
    expect(robotsForPath('/events/abc')).toBe('noindex,nofollow')
    expect(robotsForPath('/this-does-not-exist')).toBe('noindex,nofollow')
  })
})
