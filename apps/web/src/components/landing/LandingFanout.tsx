import { APP_NAME } from '@/lib/app-meta'

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

const ENDS = [
  { y: 18, host: 'billing.acme.dev', code: '200', meta: 'delivered', tone: 'ok' },
  { y: 86, host: 'hooks.crm.io', code: '200', meta: 'delivered', tone: 'ok' },
  { y: 154, host: 'notify.acme.dev', code: '429', meta: 'retrying', tone: 'retry' },
] as const

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
  return (
    <div
      className="lp-fanout"
      role="img"
      aria-label={`${APP_NAME} accepts order.paid, signs deliveries, delivers two endpoints, and schedules a retry for a 429 in the ledger.`}
    >
      <div className="lp-fanout__stage">
        <svg className="lp-fanout__svg" viewBox="0 0 700 216" xmlns="http://www.w3.org/2000/svg">
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

          <path d={PATHS.in} className="lp-fanout__wire lp-fanout__wire--in" />
          <path d={PATHS.trunk} className="lp-fanout__wire lp-fanout__wire--trunk" />
          <path d={PATHS.out3} className="lp-fanout__wire lp-fanout__wire--out3" />
          <path d={PATHS.out1} className="lp-fanout__wire lp-fanout__wire--out1" />
          <path d={PATHS.out2} className="lp-fanout__wire lp-fanout__wire--out2" />

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
        </svg>
      </div>

      <div className="lp-fanout__ledger">
        <span className="lp-fanout__ledger-kicker">ledger</span>
        <span className="lp-fanout__ledger-body">
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
