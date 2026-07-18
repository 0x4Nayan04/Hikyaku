import { cn } from '@/lib/utils'

export type EndpointStatusTab = 'all' | 'active' | 'disabled' | 'failed'

type EndpointStatusTabsProps = {
  activeTab: EndpointStatusTab
  counts: Record<EndpointStatusTab, number>
  onChange: (tab: EndpointStatusTab) => void
}

const LIFECYCLE_TABS: Array<{
  id: Exclude<EndpointStatusTab, 'failed'>
  label: string
}> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'disabled', label: 'Disabled' },
]

export function EndpointStatusTabs({ activeTab, counts, onChange }: EndpointStatusTabsProps) {
  return (
    <div className="endpoint-status-tabs" role="tablist" aria-label="Endpoint status">
      {LIFECYCLE_TABS.map((tab) => {
        const selected = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              'endpoint-status-tab',
              selected && 'endpoint-status-tab--selected',
              selected && `endpoint-status-tab--${tab.id}`,
            )}
            onClick={() => onChange(tab.id)}
          >
            <span className="endpoint-status-tab__label">{tab.label}</span>
            <span
              className={cn(
                'endpoint-status-tab__count',
                selected && `endpoint-status-tab__count--${tab.id}`,
              )}
            >
              {counts[tab.id]}
            </span>
          </button>
        )
      })}

      <span className="endpoint-status-tabs__divider" aria-hidden="true" />

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'failed'}
        title="Endpoints whose last delivery failed (any lifecycle status)"
        className={cn(
          'endpoint-status-tab',
          activeTab === 'failed' && 'endpoint-status-tab--selected',
          activeTab === 'failed' && 'endpoint-status-tab--failed',
        )}
        onClick={() => onChange('failed')}
      >
        <span className="endpoint-status-tab__label">Has failures</span>
        <span
          className={cn(
            'endpoint-status-tab__count',
            activeTab === 'failed' && 'endpoint-status-tab__count--failed',
          )}
        >
          {counts.failed}
        </span>
      </button>
    </div>
  )
}
