import { cn } from '@/lib/utils'

type HikyakuMarkProps = {
  className?: string
}

/** Brand mark — navy seal with white H and red accent. */
export function HikyakuMark({ className }: HikyakuMarkProps) {
  return (
    <picture className={cn('inline-block shrink-0 leading-none', className)}>
      <source srcSet="/logo/hikyaku-icon.webp" type="image/webp" />
      <img
        src="/logo/hikyaku-icon.png"
        alt=""
        aria-hidden
        draggable={false}
        width={256}
        height={256}
        className="block size-full object-contain"
      />
    </picture>
  )
}
