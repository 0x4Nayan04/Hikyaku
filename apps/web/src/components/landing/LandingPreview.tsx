import { LandingFrameInner } from '@/components/landing/LandingFrameInner'

const PREVIEW_SIZE = { width: 1512, height: 949 } as const
const PREVIEW_SIZES = '(max-width: 900px) 100vw, 1512px'

const SECONDARY_SHOTS = [
  {
    src: '/landing/console-deliveries.png',
    alt: 'Hikyaku deliveries log showing outbound webhook attempts and their status',
    label: 'Deliveries',
    caption: 'Every outbound attempt, filterable by status.',
  },
  {
    src: '/landing/console-delivery-detail.png',
    alt: 'Hikyaku delivery detail page showing the attempt timeline and response body',
    label: 'Attempt detail',
    caption: 'Response code, timing, and body for every attempt.',
  },
] as const

function previewWebpSrcSet(pngSrc: string): string {
  const base = pngSrc.replace(/\.png$/, '')
  return `${base}-800w.webp 800w, ${base}.webp 1512w`
}

function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <picture>
      <source type="image/webp" srcSet={previewWebpSrcSet(src)} sizes={PREVIEW_SIZES} />
      <img
        src={src}
        alt={alt}
        className={className}
        width={PREVIEW_SIZE.width}
        height={PREVIEW_SIZE.height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}

export function LandingPreview() {
  return (
    <section id="preview" className="lp-preview scroll-mt-(--nav-height)" aria-labelledby="preview-heading">
      <LandingFrameInner className="lp-section">
        <header className="lp-split-heading">
          <h2 id="preview-heading">
            A console that shows <em>what happened</em>.
          </h2>
          <p>The real dashboard — not a mockup. Every event and delivery, inspectable.</p>
        </header>

        <div className="lp-preview__main">
          <PreviewImage
            src="/landing/console-dashboard.png"
            alt="Hikyaku dashboard showing ingest metrics, 24-hour delivery outcomes, and recent activity"
            className="lp-preview__main-image"
          />
        </div>

        <div className="lp-preview__grid">
          {SECONDARY_SHOTS.map((shot) => (
            <figure key={shot.label} className="lp-preview__card">
              <PreviewImage src={shot.src} alt={shot.alt} />
              <figcaption>
                <span className="lp-preview__card-label">{shot.label}</span>
                <span>{shot.caption}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </LandingFrameInner>
    </section>
  )
}
