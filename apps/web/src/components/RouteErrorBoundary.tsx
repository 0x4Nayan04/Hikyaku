import { Component, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type BoundaryProps = {
  children: ReactNode
  resetKey: string
  fullPage: boolean
}

type BoundaryState = { failed: boolean; resetKey: string }

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  render() {
    if (!this.state.failed) return this.props.children

    const message = (
      <div role="alert" className="flex flex-col items-start gap-4 p-6">
        <h1 className="text-2xl font-semibold text-foreground">Could not load this page</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          The page could not be displayed. Reload to try again. Unsaved changes may be lost.
        </p>
        <Button onClick={() => globalThis.location.reload()}>Reload page</Button>
      </div>
    )

    return this.props.fullPage ? (
      <main id="main-content" className="grid min-h-svh place-items-center bg-background">
        {message}
      </main>
    ) : (
      message
    )
  }
}

export function RouteErrorBoundary({
  children,
  fullPage = false,
}: {
  children: ReactNode
  fullPage?: boolean
}) {
  const location = useLocation()
  return (
    <ErrorBoundary resetKey={location.key} fullPage={fullPage}>
      {children}
    </ErrorBoundary>
  )
}
