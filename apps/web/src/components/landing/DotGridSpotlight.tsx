import { useEffect, useRef, useState } from 'react'

type DotGridSpotlightProps = {
  dotColor?: string
  activeDotColor?: string
  spacing?: number
  baseRadius?: number
  activeRadius?: number
  interactionRadius?: number
  activeMaxAlpha?: number
  activeMinAlpha?: number
  interactionRef?: React.RefObject<HTMLElement | null>
  className?: string
}

export function DotGridSpotlight({
  dotColor = 'rgba(255, 255, 255, 0.05)',
  activeDotColor = 'rgba(255, 255, 255, 0.1)',
  spacing = 10,
  baseRadius = 1,
  activeRadius = 2,
  interactionRadius = 128,
  activeMaxAlpha = 1.0,
  activeMinAlpha = 0.5,
  interactionRef = null,
  className,
}: DotGridSpotlightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -1000, y: -1000, isActive: false })
  const [reducedMotion, setReducedMotion] = useState(false)
  const [interactive, setInteractive] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointerMedia = window.matchMedia('(pointer: coarse), (max-width: 640px)')
    const update = () => setReducedMotion(media.matches)
    const updatePointer = () => setInteractive(!media.matches && !pointerMedia.matches)
    update()
    updatePointer()
    media.addEventListener('change', update)
    media.addEventListener('change', updatePointer)
    pointerMedia.addEventListener('change', updatePointer)
    return () => {
      media.removeEventListener('change', update)
      media.removeEventListener('change', updatePointer)
      pointerMedia.removeEventListener('change', updatePointer)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const trackEl = interactive ? (interactionRef?.current ?? canvas) : null

    let width = 0
    let height = 0
    let renderFrameId: number | null = null
    const interactionRadiusSquared = interactionRadius * interactionRadius

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      const gridSpacing = Math.max(spacing, Math.ceil(Math.max(width, height) / 160))
      const offsetX = (width % gridSpacing) / 2
      const offsetY = (height % gridSpacing) / 2

      for (let x = offsetX; x <= width; x += gridSpacing) {
        for (let y = offsetY; y <= height; y += gridSpacing) {
          const dx = x - mouse.current.x
          const dy = y - mouse.current.y
          const distanceSquared = dx * dx + dy * dy

          let currentRadius = baseRadius
          let currentColor = dotColor
          let currentAlpha = 1.0

          if (interactive && mouse.current.isActive && distanceSquared < interactionRadiusSquared) {
            const factor = 1 - Math.sqrt(distanceSquared) / interactionRadius
            currentRadius = baseRadius + (activeRadius - baseRadius) * factor
            currentColor = activeDotColor
            currentAlpha = activeMinAlpha + (activeMaxAlpha - activeMinAlpha) * factor
          }

          ctx.globalAlpha = currentAlpha
          ctx.beginPath()
          ctx.arc(x, y, currentRadius, 0, Math.PI * 2)
          ctx.fillStyle = currentColor
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1.0
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (!parent) return

      const dpr = window.devicePixelRatio || 1
      width = parent.clientWidth
      height = parent.clientHeight

      if (width === 0 || height === 0) return

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      draw()
      requestAnimationFrame(() => {
        canvas.dataset.ready = 'true'
      })
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        isActive: true,
      }

      if (renderFrameId === null) {
        renderFrameId = requestAnimationFrame(() => {
          draw()
          renderFrameId = null
        })
      }
    }

    const handleMouseLeave = () => {
      mouse.current.isActive = false
      if (renderFrameId === null) {
        renderFrameId = requestAnimationFrame(() => {
          draw()
          renderFrameId = null
        })
      }
    }

    trackEl?.addEventListener('mousemove', handleMouseMove)
    trackEl?.addEventListener('mouseleave', handleMouseLeave)

    const resizeObserver = new ResizeObserver(() => resizeCanvas())
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    resizeCanvas()

    return () => {
      trackEl?.removeEventListener('mousemove', handleMouseMove)
      trackEl?.removeEventListener('mouseleave', handleMouseLeave)
      resizeObserver.disconnect()
      if (renderFrameId !== null) cancelAnimationFrame(renderFrameId)
    }
  }, [
    reducedMotion,
    interactive,
    spacing,
    baseRadius,
    activeRadius,
    interactionRadius,
    dotColor,
    activeDotColor,
    activeMaxAlpha,
    activeMinAlpha,
    interactionRef,
  ])

  return (
    <canvas
      ref={canvasRef}
      data-ready="false"
      className={[
        'pointer-events-none absolute inset-0 block opacity-0 transition-opacity duration-500 data-[ready=true]:opacity-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
