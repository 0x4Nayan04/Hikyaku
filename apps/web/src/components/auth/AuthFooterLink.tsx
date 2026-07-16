import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

type AuthFooterLinkProps = {
  prompt: string
  linkLabel: string
  to: string
}

export function AuthFooterLink({ prompt, linkLabel, to }: AuthFooterLinkProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{prompt}</span>
      <Link
        to={to}
        className="group inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:text-[var(--color-primary-hover)]"
      >
        {linkLabel}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  )
}
