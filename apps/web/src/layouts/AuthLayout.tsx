import type { ReactNode } from 'react'
import { AuthNavbar } from '@/components/auth/AuthNavbar'
import { AppCatalogShell, LandingSectionBlock } from '@/components/app/AppCatalogShell'
import { HeroDotGridWrap } from '@/components/landing/HeroDotGridWrap'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'


type AuthLayoutProps = {
  children: ReactNode
  eyebrow: string
  title: string
  description: string
  wide?: boolean
  variant?: 'centered' | 'split'
  sidePanel?: ReactNode
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
          <HeroDotGridWrap
            wrapClassName="relative flex flex-col overflow-hidden bg-surface-muted lg:w-1/2 lg:max-w-xl"
            className="relative z-10 flex flex-col p-8 lg:p-12 h-full"
          >
            {sidePanel}
          </HeroDotGridWrap>

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
        <HeroDotGridWrap wrapClassName="auth-page-dot-grid bg-surface" className="auth-page-inner">
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
        </HeroDotGridWrap>
      </LandingSectionBlock>
    </AppCatalogShell>
  )
}
