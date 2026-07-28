import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, FileCode, Layers, Settings } from 'lucide-react'

import { DocsBadge } from '@/components/docs/DocsBadge'
import { DOCS_NAV, docPath } from '@/docs/config'
import { APP_NAME } from '@/lib/app-meta'

const GROUP_ICONS = {
  'Getting started': BookOpen,
  'Core concepts': Layers,
  'Platform reference': FileCode,
  Operations: Settings,
} as const

export function DocsHome() {
  return (
    <div className="docs-v2-home">
      <section className="docs-v2-home-hero" aria-labelledby="docs-overview-title">
        <div className="docs-v2-home-hero-inner">
          <div className="docs-v2-home-hero-copy">
            <h1 id="docs-overview-title" className="docs-v2-home-title">
              {APP_NAME} Docs
            </h1>
            <p className="docs-v2-home-lead">
              Ingest events, HMAC-signed deliveries, retries, and the delivery console.
            </p>
          </div>
          <Link to={docPath('quick-start')} className="sm-btn sm-btn-primary sm-btn-split focus-ring">
            <span className="sm-btn-split-label">Quick start</span>
            <span className="sm-btn-split-icon">
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      <div className="docs-v2-home-body">
        {DOCS_NAV.map((group) => {
          const GroupIcon = GROUP_ICONS[group.label as keyof typeof GROUP_ICONS] ?? BookOpen

          return (
            <section key={group.label} className="docs-v2-home-section">
              <div className="docs-v2-home-section-head">
                <span className="docs-v2-home-section-icon" aria-hidden="true">
                  <GroupIcon size={16} />
                </span>
                <h2 className="docs-v2-home-section-title">{group.label}</h2>
              </div>
              <div className="docs-v2-card-grid">
                {group.items.map((item) => (
                  <Link key={item.slug} to={docPath(item.slug)} className="docs-v2-card">
                    <span className="docs-v2-card-copy">
                      <span className="docs-v2-card-title-row">
                        <span className="docs-v2-card-title">{item.label}</span>
                        <DocsBadge type={item.badge} />
                      </span>
                      <span className="docs-v2-card-desc">{item.description}</span>
                    </span>
                    <ArrowRight className="docs-v2-card-arrow" size={15} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
