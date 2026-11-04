import { lazy, Suspense, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { LandingHero } from '@/components/landing/LandingHero'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@/styles/domains/chrome.css'
import '@/styles/domains/landing.css'

const LandingFeatures = lazy(() =>
  import('@/components/landing/LandingFeatures').then((m) => ({ default: m.LandingFeatures })),
)
const LandingHowItWorks = lazy(() =>
  import('@/components/landing/LandingHowItWorks').then((m) => ({ default: m.LandingHowItWorks })),
)
const LandingPreview = lazy(() =>
  import('@/components/landing/LandingPreview').then((m) => ({ default: m.LandingPreview })),
)
const LandingFaq = lazy(() =>
  import('@/components/landing/LandingFaq').then((m) => ({ default: m.LandingFaq })),
)
const LandingFinalCta = lazy(() =>
  import('@/components/landing/LandingFinalCta').then((m) => ({ default: m.LandingFinalCta })),
)
const LandingFooter = lazy(() =>
  import('@/components/landing/LandingFooter').then((m) => ({ default: m.LandingFooter })),
)

export function Landing() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    const id = hash.replace(/^#/, '')
    if (!id) return
    let tries = 0
    const scrollToHash = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (tries++ < 60) requestAnimationFrame(scrollToHash)
    }
    requestAnimationFrame(scrollToHash)
  }, [hash, pathname])

  return (
    <div className="landing-page flex min-h-screen flex-col scroll-smooth">
      <LandingFrame>
        <LandingNavbar />
        <main id="main-content" className="flex-1">
          <LandingHero />
          <Suspense fallback={null}>
            <LandingFeatures />
            <LandingHowItWorks />
            <LandingPreview />
            <LandingFaq />
            <LandingFinalCta />
          </Suspense>
        </main>
        <div className="site-footer-block">
          <Suspense fallback={null}>
            <LandingFooter />
          </Suspense>
        </div>
      </LandingFrame>
    </div>
  )
}
