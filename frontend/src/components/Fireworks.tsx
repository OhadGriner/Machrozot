import { useEffect, useRef } from 'react'

const COLORS = ['#4ade80', '#c084fc', '#fb923c', '#60a5fa', '#f472b6', '#facc15']
const GRAVITY = 0.05
const PARTICLES_PER_BURST = 40
const BURST_INTERVAL_MS = 400

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
}

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let particles: Particle[] = []

    const spawnBurst = () => {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height * 0.5
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const angle = (Math.PI * 2 * i) / PARTICLES_PER_BURST
        const speed = 2 + Math.random() * 3
        particles.push({
          x, y, color, alpha: 1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        })
      }
    }

    const burstTimer = setInterval(spawnBurst, BURST_INTERVAL_MS)
    spawnBurst()

    let frameId: number
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles = particles.filter((p) => p.alpha > 0.02)
      for (const p of particles) {
        p.vy += GRAVITY
        p.x += p.vx
        p.y += p.vy
        p.alpha *= 0.96
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      frameId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      clearInterval(burstTimer)
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  )
}
