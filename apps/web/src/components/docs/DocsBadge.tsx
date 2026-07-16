import type { DocBadge } from '@/docs/config'

const BADGE_CLASS: Record<DocBadge, string> = {
  guide: 'docs-v2-badge--guide',
  concept: 'docs-v2-badge--concept',
  reference: 'docs-v2-badge--reference',
}

export function DocsBadge({ type }: { type: DocBadge }) {
  return <span className={`docs-v2-badge ${BADGE_CLASS[type]}`}>{type}</span>
}
