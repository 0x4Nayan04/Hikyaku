import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { WebhookMark } from '@/components/auth/WebhookMark'
import { CatalogButton } from '@/components/catalog/CatalogButton'

export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-5 text-center">
      <WebhookMark className="size-10 text-primary" />
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-strong">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <CatalogButton variant="secondary" asChild className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]">
          <Link to="/">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Home
          </Link>
        </CatalogButton>
        <CatalogButton className="sm-btn-split h-[2.125rem] min-h-0" asChild>
          <Link to="/dashboard">
            <span className="sm-btn-split-label text-[0.8125rem]">Go to dashboard</span>
            <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </CatalogButton>
      </div>
    </div>
  )
}
