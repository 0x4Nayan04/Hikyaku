import { useEffect, useState } from 'react'

import { DOCS_TOC } from '@/docs/toc'

export function DocsSidebar() {
  const [activeId, setActiveId] = useState(DOCS_TOC[0]?.id ?? '')

  useEffect(() => {
    const root = document.querySelector('.docs-body')
    const sections = DOCS_TOC.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => node != null,
    )
    if (!(root instanceof HTMLElement) || sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0]?.target.id
        if (id) setActiveId(id)
      },
      { root, rootMargin: '-12% 0px -68% 0px', threshold: [0, 1] },
    )

    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && DOCS_TOC.some((item) => item.id === hash)) setActiveId(hash)
  }, [])

  return (
    <aside className="docs-sidebar">
      <nav className="docs-sidebar-nav" aria-label="On this page">
        <p className="docs-sidebar-label">On this page</p>
        <ul className="docs-sidebar-list">
          {DOCS_TOC.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={
                  activeId === item.id
                    ? 'docs-sidebar-link docs-sidebar-link--active'
                    : 'docs-sidebar-link'
                }
                aria-current={activeId === item.id ? 'location' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
