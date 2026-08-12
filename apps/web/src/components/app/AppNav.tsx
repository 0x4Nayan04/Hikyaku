import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { filterNavSections, isNavItemActive } from '@/layouts/app-nav'
import { markNavDescriptionsSeen, shouldShowNavDescriptions } from '@/lib/nav-descriptions'
import { cn } from '@/lib/utils'

type AppNavProps = {
  isSuperAdmin: boolean
  onNavigate?: () => void
  variant?: 'sidebar' | 'mobile'
}

export function AppNav({ isSuperAdmin, onNavigate, variant = 'sidebar' }: AppNavProps) {
  const location = useLocation()
  const sections = filterNavSections(isSuperAdmin)
  const allItems = sections.flatMap((section) => section.items)
  const isMobile = variant === 'mobile'
  // Show subtitles for this first visit; hide on later sessions.
  const [showDescriptions] = useState(shouldShowNavDescriptions)

  useEffect(() => {
    markNavDescriptionsSeen()
  }, [])

  return (
    <nav
      className={cn(
        'flex flex-col',
        isMobile ? 'gap-4' : 'gap-0',
        !showDescriptions && 'app-nav--compact',
      )}
      aria-label="Console"
      data-nav-compact={!showDescriptions ? 'true' : undefined}
    >
      {sections.map((section) => (
        <div key={section.id} className="app-nav-section">
          <p className="app-nav-section-label">{section.label}</p>
          <ul
            className={cn(
              'mt-1 flex flex-col gap-0.5',
              isMobile && 'border border-border bg-surface',
            )}
          >
            {section.items.map((item, itemIndex) => {
              const Icon = item.icon
              const active = isNavItemActive(location.pathname, item, allItems)
              const description = showDescriptions ? item.description : undefined

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={!showDescriptions ? item.description : undefined}
                    className={cn(
                      isMobile
                        ? cn(
                            'catalog-row catalog-link-row outline-none',
                            active && 'catalog-row--active bg-background-alt',
                          )
                        : cn('app-nav-link', active && 'app-nav-link-active'),
                    )}
                  >
                    {isMobile ? (
                      <>
                        <span className="catalog-link-row-index">
                          {String(itemIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="catalog-link-row-label">{item.title}</span>
                          {description ? (
                            <span className="mt-0.5 block text-xs text-muted-strong">
                              {description}
                            </span>
                          ) : null}
                        </span>
                        <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
                      </>
                    ) : (
                      <>
                        <span className="app-nav-icon" aria-hidden="true">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="app-nav-link-title block truncate leading-snug">
                            {item.title}
                          </span>
                          {description ? (
                            <span className="app-nav-link-desc mt-0.5 block truncate text-xs leading-snug">
                              {description}
                            </span>
                          ) : null}
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
