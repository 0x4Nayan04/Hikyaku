import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { APP_HOME_LABEL, APP_NAME } from '@/lib/app-meta'

export function AuthNavbar() {
  return (
    <header className="sticky top-0 z-50 h-[var(--nav-height)] border-b border-border bg-surface">
      <LandingFrameInner className="!px-0 h-full">
        <div className="landing-frame-px flex h-full items-center justify-between gap-4">
          <Link to="/" className="landing-nav-brand focus-ring" aria-label={APP_HOME_LABEL}>
            <HikyakuMark decorative className="size-7 shrink-0" />
            <span className="landing-nav-brand-text">{APP_NAME}</span>
          </Link>
          <Link
            to="/"
            title={APP_HOME_LABEL}
            aria-label={APP_HOME_LABEL}
            className="sm-btn sm-btn-sm sm-btn-secondary focus-ring"
          >
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            Back to {APP_NAME} home
          </Link>
        </div>
      </LandingFrameInner>
    </header>
  )
}
