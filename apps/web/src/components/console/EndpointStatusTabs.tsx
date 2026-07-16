import { cn } from '@/lib/utils'

export type EndpointStatusTab = 'all' | 'active' | 'disabled' | 'failed'

type EndpointStatusTabsProps = {
  activeTab: EndpointStatusTab
  counts: Record<EndpointStatusTab, number>
  onChange: (tab: EndpointStatusTab) => void
}

const TAB_CONFIG: Array<{
  id: EndpointStatusTab
  label: string
}> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'failed', label: 'Failed' },
]

export function EndpointStatusTabs({ activeTab, counts, onChange }: EndpointStatusTabsProps) {
  return (
    <div className="endpoint-status-tabs" role="tablist" aria-label="Endpoint status">
      {TAB_CONFIG.map((tab) => {
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
    </div>
  )
}
