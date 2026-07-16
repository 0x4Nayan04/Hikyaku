import type { LucideIcon } from 'lucide-react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type PageBannerProps = {
  variant: 'info' | 'success' | 'error'
  title: string
  description: string
  className?: string
}

const config: Record<PageBannerProps['variant'], { icon: LucideIcon; className: string }> = {
  info: {
    icon: Info,
    className:
      'border-status-info-border bg-status-info-subtle text-foreground [&>svg]:text-status-info',
  },
  success: {
    icon: CheckCircle2,
    className:
      'border-status-success-border bg-status-success-subtle text-status-success [&>svg]:text-status-success',
  },
  error: {
    icon: AlertCircle,
    className:
      'border-status-danger-border bg-status-danger-subtle text-status-danger [&>svg]:text-status-danger',
  },
}

export function PageBanner({ variant, title, description, className }: PageBannerProps) {
  const { icon: Icon, className: variantClassName } = config[variant]

  return (
    <Alert
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(variantClassName, className)}
    >
      <Icon className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}
