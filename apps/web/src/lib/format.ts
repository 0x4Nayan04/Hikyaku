const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatStatusLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatPercent(rate: number | null, emptyLabel = '—'): string {
  if (rate === null) {
    return emptyLabel
  }
  return `${Math.round(rate * 100)}%`
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

export function formatCreatedStacked(iso: string): { date: string; time: string } {
  const value = new Date(iso)
  return {
    date: dateFormatter.format(value),
    time: timeFormatter.format(value),
  }
}

const deliveryDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** Relative time for recent deliveries; absolute date for older ones (matches endpoint table mock). */
export function formatDeliveryTime(iso: string): string {
  const ageMs = Date.now() - Date.parse(iso)
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  if (ageMs < sevenDays) {
    return formatRelativeTime(iso)
  }
  return deliveryDateFormatter.format(new Date(iso))
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

function formatRelativeTime(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000)
  const absSeconds = Math.abs(seconds)

  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (absSeconds >= unitSeconds || unit === 'second') {
      const value = Math.round(seconds / unitSeconds)
      return relativeTimeFormatter.format(value, unit)
    }
  }

  return relativeTimeFormatter.format(0, 'second')
}

export function shortId(value: string, visible = 8): string {
  if (value.length <= visible + 1) return value
  return `${value.slice(0, visible)}…`
}

const DELIVERY_ERROR_LABELS: Record<string, string> = {
  timeout: 'Timed out',
  network_error: 'Network error',
  endpoint_disabled: 'Endpoint disabled',
  blocked_url: 'Blocked URL',
  too_many_redirects: 'Too many redirects',
  max_attempts: 'Max attempts reached',
  enqueue_failed: 'Queue unavailable',
  rate_limited: 'Rate limited',
}

/** Human-readable label for delivery `last_error` codes (e.g. http_404 → HTTP 404). */
export function formatDeliveryError(error: string): string {
  const known = DELIVERY_ERROR_LABELS[error]
  if (known) return known

  const httpMatch = /^http_(\d{3})$/.exec(error)
  if (httpMatch) {
    return `HTTP ${httpMatch[1]}`
  }

  return error.replace(/_/g, ' ')
}

/** Prefer hostname + path start; truncate the end when space is tight. */
export function formatEndpointUrlForDisplay(url: string, maxLen = 56): string {
  if (url.length <= maxLen) return url

  try {
    const parsed = new URL(url)
    const origin = `${parsed.protocol}//${parsed.host}`
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const full = `${origin}${path}`

    if (full.length <= maxLen) {
      return full
    }

    const budget = maxLen - origin.length - 1
    if (budget >= 4) {
      return `${origin}${path.slice(0, budget)}…`
    }
  } catch {
    // Fall through to prefix truncation for non-standard URLs.
  }

  return `${url.slice(0, maxLen - 1)}…`
}
