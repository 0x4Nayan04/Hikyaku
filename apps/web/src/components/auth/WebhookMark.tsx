type WebhookMarkProps = {
  className?: string
}

export function WebhookMark({ className }: WebhookMarkProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="10" className="fill-primary" />
      <path
        d="M21.5 11.5H16.2V7.2H14.1V12.6C14.1 13.3 14.4 14 14.9 14.5L19.2 18.8L20.4 17.6L17.1 14.3H21.5V11.5Z"
        className="fill-primary-foreground"
        strokeDasharray="30"
        strokeDashoffset="30"
        stroke="currentColor"
        strokeWidth="0.5"
        fillOpacity="0"
        style={{ animation: 'logo-draw 0.6s ease-out 0.3s forwards' }}
      />
      <path
        d="M10.5 13.5L14.8 17.8H10.5V20H15.8V24.8H17.9V19.4C17.9 18.7 17.6 18 17.1 17.5L12.8 13.2L10.5 13.5Z"
        className="fill-primary-foreground"
        strokeDasharray="30"
        strokeDashoffset="30"
        stroke="currentColor"
        strokeWidth="0.5"
        fillOpacity="0"
        style={{ animation: 'logo-draw 0.6s ease-out 0.5s forwards' }}
      />
    </svg>
  )
}
