import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, FileCode, Layers, Settings, Zap } from 'lucide-react'

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
          <div className="docs-v2-home-hero-chip">
            <Zap size={13} aria-hidden="true" />
            <span>Documentation</span>
          </div>

          <h1 id="docs-overview-title" className="docs-v2-home-title">
            {APP_NAME} Docs
          </h1>

          <p className="docs-v2-home-lead">
            API and console docs for ingesting events, HMAC-signed deliveries, retries, and the
            delivery console.
          </p>

          <div className="docs-v2-home-actions">
            <Link to={docPath('quick-start')} className="sm-btn sm-btn-primary sm-btn-split focus-ring">
              <span className="sm-btn-split-label">Quick start</span>
              <span className="sm-btn-split-icon">
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
            <Link to={docPath('introduction')} className="sm-btn sm-btn-ghost focus-ring">
              Read the intro
            </Link>
            <Link to={docPath('api-reference')} className="sm-btn sm-btn-ghost focus-ring">
              API reference
            </Link>
          </div>

          <div className="docs-v2-home-hero-cats">
            {DOCS_NAV.map((group) => {
              const Icon = GROUP_ICONS[group.label as keyof typeof GROUP_ICONS] ?? BookOpen
              const firstSlug = group.items[0]?.slug
              if (!firstSlug) return null
              return (
                <Link key={group.label} to={docPath(firstSlug)} className="docs-v2-home-hero-cat">
                  <Icon size={14} aria-hidden="true" />
                  <span>{group.label}</span>
                  <ArrowRight size={12} className="docs-v2-home-hero-cat-arrow" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
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
                <div className="docs-v2-home-section-meta">
                  <h2 className="docs-v2-home-section-title">{group.label}</h2>
                  <p className="docs-v2-home-section-count">
                    {group.items.length} {group.items.length === 1 ? 'article' : 'articles'}
                  </p>
                </div>
              </div>
              <div className="docs-v2-card-grid">
                {group.items.map((item) => (
                  <Link key={item.slug} to={docPath(item.slug)} className="docs-v2-card">
                    <span className="docs-v2-card-top">
                      <DocsBadge type={item.badge} />
                      <ArrowRight className="docs-v2-card-arrow" size={15} aria-hidden="true" />
                    </span>
                    <span className="docs-v2-card-title">{item.label}</span>
                    <span className="docs-v2-card-desc">{item.description}</span>
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
