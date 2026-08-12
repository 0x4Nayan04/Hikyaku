import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { titleForPath } from '@/lib/page-title'

export function DocumentTitle() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    document.title = titleForPath(pathname, hash)
  }, [pathname, hash])

  return null
}
