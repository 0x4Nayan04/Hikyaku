import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingConsolePreview } from '@/components/landing/LandingConsolePreview'
import { LandingFaq } from '@/components/landing/LandingFaq'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks'

export function Landing() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    const id = hash.replace(/^#/, '')
    if (!id) return
    const scrollToHash = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    requestAnimationFrame(scrollToHash)
  }, [hash, pathname])

  return (
    <div className="landing-page flex min-h-screen flex-col scroll-smooth">
      <LandingFrame>
        <LandingNavbar />
        <main id="main-content" className="flex-1">
          <LandingHero />
          <LandingHowItWorks />
          <LandingConsolePreview />
          <LandingFaq />
        </main>
        <div className="site-footer-block">
          <LandingFooter />
        </div>
      </LandingFrame>
    </div>
  )
}
