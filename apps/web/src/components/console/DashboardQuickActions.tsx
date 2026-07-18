import { Link } from 'react-router-dom'
import { ChevronRight, Package, Send, Webhook, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuickAction = {
  to: string
  icon: LucideIcon
  tone: 'info' | 'success' | 'neutral'
  title: string
  hint: string
}

const actions: QuickAction[] = [
  {
    to: '/events/send',
    icon: Send,
    tone: 'info',
    title: 'Send event',
    hint: 'POST a test event',
  },
  {
    to: '/deliveries',
    icon: Package,
    tone: 'success',
    title: 'View deliveries',
    hint: 'Outbound attempts',
  },
  {
    to: '/endpoints',
    icon: Webhook,
    tone: 'neutral',
    title: 'Manage endpoints',
    hint: 'URLs and signing secrets',
  },
]

const toneIconClass = {
  info: 'dashboard-activity-row__icon--event',
  success: 'dashboard-activity-row__icon--delivery',
  neutral: 'dashboard-activity-row__icon--neutral',
} as const

export function DashboardQuickActions() {
  return (
    <div className="dashboard-activity-list">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.to}
            to={action.to}
            className="dashboard-activity-row group"
          >
            <span
              className={cn('dashboard-activity-row__icon', toneIconClass[action.tone])}
              aria-hidden="true"
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="dashboard-activity-row__main">
              <p className="dashboard-activity-row__name">{action.title}</p>
              <p className="dashboard-panel-row__hint">{action.hint}</p>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-strong/40 transition-colors duration-150 group-hover:text-primary"
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        )
      })}
    </div>
  )
}
