import { Link } from 'react-router-dom'

import { APP_NAME, PRODUCT_LINKS } from '@/lib/app-meta'

export function DocsFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="docs-footer">
      <p className="docs-footer__copy">
        © {year} {APP_NAME}
      </p>
      <nav className="docs-footer__nav" aria-label="Docs footer">
        <Link to="/">Home</Link>
        <Link to={PRODUCT_LINKS.docs}>Docs</Link>
        <a href="#api-reference">API reference</a>
        <a href="#privacy">Privacy</a>
        <Link to="/login">Sign in</Link>
      </nav>
    </footer>
  )
}
