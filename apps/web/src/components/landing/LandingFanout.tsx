import { APP_NAME } from '@/lib/app-meta'
import { useEffect, useRef } from 'react'

/**
 * Packed stage — nodes fill the frame; spine at y=108.
 * viewBox sized to content (no tall empty letterbox).
 */
const PATHS = {
  in: 'M 156 108 H 236',
  trunk: 'M 396 108 H 428',
  out1: 'M 428 108 C 452 78, 496 40, 548 40',
  out2: 'M 428 108 H 548',
  out3: 'M 428 108 C 452 138, 496 176, 548 176',
} as const

const MOTION = {
  out1: 'M 396 108 H 428 C 452 78, 496 40, 548 40',
  out2: 'M 396 108 H 548',
  out3: 'M 396 108 H 428 C 452 138, 496 176, 548 176',
} as const

const ENDS = [
  { y: 18, host: 'billing.acme.dev', code: '200', meta: 'delivered', tone: 'ok' },
  { y: 86, host: 'hooks.crm.io', code: '200', meta: 'delivered', tone: 'ok' },
  { y: 154, host: 'notify.acme.dev', code: '429', meta: 'retrying', tone: 'retry' },
] as const

function begin(el: Element) {
  if (!('beginElement' in el)) return
  const anim = el as SVGAnimationElement
  if (typeof anim.beginElement === 'function') anim.beginElement()
}

function Packet({
  pathId,
  tone,
  dur,
  className,
  gap = false,
}: {
  pathId: string
  tone: 'navy' | 'seal'
  dur: string
  className?: string
  gap?: boolean
}) {
  return (
    <circle
      r="4"
      className={`lp-fanout__packet lp-fanout__packet--${tone}${className ? ` ${className}` : ''}`}
      opacity="0"
    >
      <animate
        attributeName="opacity"
        values={gap ? '0;1;1;0;0' : '0;1;1;0'}
        keyTimes={gap ? '0;0.08;0.38;0.48;1' : '0;0.12;0.82;1'}
        calcMode="linear"
        dur={dur}
        begin="indefinite"
        repeatCount="indefinite"
      />
      <animateMotion
        dur={dur}
        begin="indefinite"
        repeatCount="indefinite"
        calcMode="linear"
        keyPoints={gap ? '0;1;1' : '0;1'}
        keyTimes={gap ? '0;0.48;1' : '0;1'}
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  )
}

function Endpoint({ y, host, code, meta, tone }: (typeof ENDS)[number]) {
  return (
    <g className={`lp-fanout__end lp-fanout__end--${tone}`} transform={`translate(548 ${y})`}>
      <rect width="140" height="44" />
      <line x1="0" y1="0" x2="0" y2="44" className="lp-fanout__pip" />
      <text x="12" y="18" className="lp-fanout__host">
        {host}
      </text>
      <text x="12" y="34" className="lp-fanout__code">
        {code}
      </text>
      <text x="44" y="34" className="lp-fanout__meta">
        {meta}
      </text>
    </g>
  )
}

export function LandingFanout() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      wrap.classList.add('is-inview', 'is-signed', 'is-logged')
      return
    }

    const timers: number[] = []
    const later = (fn: () => void, delay: number) => {
      timers.push(window.setTimeout(fn, delay))
    }
    const startPacket = (selector: string, delay: number) => {
      later(() => {
        svg.querySelectorAll(`${selector} animate, ${selector} animateMotion`).forEach(begin)
      }, delay)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        wrap.classList.add('is-inview')
        startPacket('.lp-fanout__packet--in', 320)
        later(() => wrap.classList.add('is-signed'), 1420)
        startPacket('.lp-fanout__packet--o1', 1600)
        startPacket('.lp-fanout__packet--o2', 1680)
        startPacket('.lp-fanout__packet--o3', 1760)
        later(() => wrap.classList.add('is-logged'), 3520)
        io.disconnect()
      },
      { threshold: 0.3 },
    )
    io.observe(wrap)
    return () => {
      io.disconnect()
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className="lp-fanout"
      role="img"
      aria-label={`${APP_NAME} accepts order.paid, signs deliveries, delivers two endpoints, and schedules a retry for a 429 in the ledger.`}
    >
      <div className="lp-fanout__stage">
        <svg
          ref={svgRef}
          className="lp-fanout__svg"
          viewBox="0 0 700 216"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <path id="lp-f-in" d={PATHS.in} />
            <path id="lp-f-out1" d={MOTION.out1} />
            <path id="lp-f-out2" d={MOTION.out2} />
            <path id="lp-f-out3" d={MOTION.out3} />
          </defs>

          <g className="lp-fanout__event">
            <rect x="8" y="86" width="148" height="44" />
            <line x1="8" y1="86" x2="8" y2="130" className="lp-fanout__pip" />
            <text x="20" y="104" className="lp-fanout__host">
              order.paid
            </text>
            <text x="20" y="120" className="lp-fanout__code">
              202
            </text>
            <text x="52" y="120" className="lp-fanout__meta">
              accepted
            </text>
          </g>

          <path d={PATHS.in} className="lp-fanout__wire lp-fanout__wire--in" pathLength={1} />
          <path d={PATHS.trunk} className="lp-fanout__wire lp-fanout__wire--trunk" pathLength={1} />
          <path d={PATHS.out3} className="lp-fanout__wire lp-fanout__wire--out3" pathLength={1} />
          <path d={PATHS.out1} className="lp-fanout__wire lp-fanout__wire--out1" pathLength={1} />
          <path d={PATHS.out2} className="lp-fanout__wire lp-fanout__wire--out2" pathLength={1} />

          <g className="lp-fanout__hub">
            <rect x="236" y="68" width="160" height="80" />
            <image href="/logo/hikyaku-icon.webp" x="248" y="82" width="48" height="48" />
            <text x="306" y="104" className="lp-fanout__brand">
              {APP_NAME}
            </text>
            <g className="lp-fanout__stamp">
              <rect x="306" y="116" width="7" height="7" />
              <text x="318" y="123" className="lp-fanout__tag">
                signed
              </text>
            </g>
          </g>

          {ENDS.map((end) => (
            <Endpoint key={end.host} {...end} />
          ))}

          <Packet pathId="lp-f-in" tone="navy" dur="2.2s" gap className="lp-fanout__packet--in" />
          <Packet pathId="lp-f-out1" tone="navy" dur="1.5s" className="lp-fanout__packet--o1" />
          <Packet pathId="lp-f-out2" tone="navy" dur="1.35s" className="lp-fanout__packet--o2" />
          <Packet pathId="lp-f-out3" tone="seal" dur="1.75s" className="lp-fanout__packet--o3" />
        </svg>
      </div>

      <div className="lp-fanout__ledger">
        <span className="lp-fanout__ledger-kicker">ledger</span>
        <span className="lp-fanout__ledger-body">
          <span className="lp-fanout__ledger-idle">awaiting attempts</span>
          <span className="lp-fanout__ledger-row">
            <span className="lp-fanout__ledger-host">notify.acme.dev</span>
            <span className="lp-fanout__ledger-code">429</span>
            <span className="lp-fanout__ledger-meta">attempt 2/5</span>
            <span className="lp-fanout__ledger-next">retry in 32s</span>
          </span>
        </span>
      </div>
    </div>
  )
}
