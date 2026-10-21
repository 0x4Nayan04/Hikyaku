import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { robotsForPath } from '@/lib/page-robots'
import { titleForPath } from '@/lib/page-title'

function upsertRobotsMeta(content: string) {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function DocumentTitle() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    document.title = titleForPath(pathname, hash)
    upsertRobotsMeta(robotsForPath(pathname))
  }, [pathname, hash])

  return null
}
