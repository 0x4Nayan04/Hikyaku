import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { CatalogButton } from '@/components/catalog/CatalogButton'

export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-5 text-center">
      <HikyakuMark className="size-10" />
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-strong">
          That route does not exist.
        </p>
      </div>
      <div className="flex gap-3">
        <CatalogButton size="sm" variant="secondary" asChild>
          <Link to="/">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Home
          </Link>
        </CatalogButton>
        <CatalogButton size="sm" className="sm-btn-split" asChild>
          <Link to="/dashboard">
            <span className="sm-btn-split-label">Go to dashboard</span>
            <span className="sm-btn-split-icon">
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </CatalogButton>
      </div>
    </div>
  )
}
