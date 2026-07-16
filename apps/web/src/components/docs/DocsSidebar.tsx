import { LayoutGrid } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { DOCS_NAV, docPath } from '@/docs/config'

function groupLabelId(label: string): string {
  return `docs-sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`
}

export function DocsSidebar() {
  return (
    <nav className="docs-v2-sidebar" aria-label="Documentation">
      <div className="docs-v2-sidebar-scroll">
        <div className="docs-v2-sidebar-top">
          <NavLink
            to="/docs"
            end
            className={({ isActive }) =>
              `docs-v2-sidebar-overview${isActive ? ' docs-v2-sidebar-overview--active' : ''}`
            }
          >
            <span className="docs-v2-sidebar-overview-icon" aria-hidden="true">
              <LayoutGrid size={14} />
            </span>
            <span className="docs-v2-sidebar-overview-copy">
              <span className="docs-v2-sidebar-overview-title">Overview</span>
              <span className="docs-v2-sidebar-overview-desc">Documentation home</span>
            </span>
          </NavLink>
        </div>

        {DOCS_NAV.map((group) => {
          const labelId = groupLabelId(group.label)

          return (
            <section
              key={group.label}
              className="docs-v2-sidebar-group"
              aria-labelledby={labelId}
            >
              <h2 id={labelId} className="docs-v2-sidebar-group-label">
                {group.label}
              </h2>
              <ul className="docs-v2-sidebar-list">
                {group.items.map((item) => (
                  <li key={item.slug}>
                    <NavLink
                      to={docPath(item.slug)}
                      className={({ isActive }) =>
                        `docs-v2-sidebar-link${isActive ? ' docs-v2-sidebar-link--active' : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </nav>
  )
}
