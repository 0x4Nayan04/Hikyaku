import type { ReactNode } from 'react'
import { AuthNavbar } from '@/components/auth/AuthNavbar'
import { AppCatalogShell, LandingSectionBlock } from '@/components/app/AppCatalogShell'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { DotPattern } from '@/components/ui/dot-pattern'
import { cn } from '@/lib/utils'
import '@/styles/domains/auth.css'

type AuthLayoutProps = {
  children: ReactNode
  eyebrow: string
  title: string
  description: string
  wide?: boolean
  variant?: 'centered' | 'split'
  sidePanel?: ReactNode
}

function AuthDots({
  wrapClassName,
  className,
  children,
}: {
  wrapClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('relative overflow-hidden', wrapClassName)}>
      <DotPattern width={20} height={20} cr={1} className="fill-primary/25" />
      <div className={cn('relative z-10', className)}>{children}</div>
    </div>
  )
}

export function AuthLayout({
  children,
  eyebrow,
  title,
  description,
  wide,
  variant = 'centered',
  sidePanel,
}: AuthLayoutProps) {
  if (variant === 'split') {
    return (
      <AppCatalogShell>
        <AuthNavbar />
        <div className="flex flex-1 flex-col lg:flex-row min-h-0">
          <AuthDots
            wrapClassName="relative flex flex-col overflow-hidden bg-surface-muted lg:w-1/2 lg:max-w-xl"
            className="relative z-10 flex flex-col p-8 lg:p-12 h-full"
          >
            {sidePanel}
          </AuthDots>

          <div className="flex flex-1 items-start justify-center overflow-y-auto bg-surface px-8 pb-6 pt-5 lg:px-10 lg:pb-10 lg:pt-6">
            <div className="w-full max-w-lg">
              <header className="mb-4">
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  {eyebrow}
                </p>
              </header>

              {children}
            </div>
          </div>
        </div>
      </AppCatalogShell>
    )
  }

  return (
    <AppCatalogShell>
      <AuthNavbar />
      <LandingSectionBlock className="auth-section-block flex flex-1 flex-col">
        <AuthDots wrapClassName="auth-page-dot-grid bg-surface" className="auth-page-inner">
          <LandingFrameInner>
            <div className={`auth-form-shell mx-auto w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
              <header className="auth-form-header mb-5">
                <p className="auth-eyebrow font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  {eyebrow}
                </p>
                <h1 className="auth-form-title mt-1.5 font-display text-2xl font-medium tracking-tight text-ink">
                  {title}
                </h1>
                <p className="auth-form-desc mt-1.5 text-sm leading-relaxed text-muted-strong">
                  {description}
                </p>
              </header>

              {children}
            </div>
          </LandingFrameInner>
        </AuthDots>
      </LandingSectionBlock>
    </AppCatalogShell>
  )
}
