import { APP_NAME } from '@/lib/app-meta'
import { cn } from '@/lib/utils'

type HikyakuMarkProps = {
  className?: string
  /** Hide from assistive tech when adjacent visible text already names the brand. */
  decorative?: boolean
}

/** Brand mark — navy seal with white H and red accent. */
export function HikyakuMark({ className, decorative = false }: HikyakuMarkProps) {
  return (
    <picture className={cn('inline-block shrink-0 leading-none', className)}>
      <source srcSet="/logo/hikyaku-icon.webp" type="image/webp" />
      <img
        src="/logo/hikyaku-icon.png"
        alt={decorative ? '' : APP_NAME}
        aria-hidden={decorative || undefined}
        draggable={false}
        width={256}
        height={256}
        className="block size-full object-contain"
      />
    </picture>
  )
}
