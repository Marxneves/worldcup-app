import { useEffect, useState } from 'react'

type Particle = {
  id: number
  x: number
  size: number
  duration: number
  delay: number
  color: string
}

const COLORS = ['#FFDF00', '#FFDF00', '#FFDF00', '#009C3B', '#009C3B', '#002776']

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i / count) * 98 + Math.sin(i * 2.4) * 4,
    size: 7 + (i % 4) * 2.5,
    duration: 7 + (i % 6) * 1.4,
    delay: -(i * 0.6),
    color: COLORS[i % COLORS.length],
  }))
}

export default function BrazilDayOverlay() {
  const [particles] = useState<Particle[]>(() => generateParticles(22))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      {/* Rhombus watermark — large faint diamond in the bg */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 340,
          height: 340,
          transform: 'translate(-50%, -50%) rotate(45deg)',
          border: '28px solid #FFDF00',
          opacity: 0.04,
        }}
      />

      {/* Floating diamond particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-5vh',
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: 'rotate(45deg)',
            opacity: 0,
            animation: `brazil-float ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Subtle top strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #FFDF00 30%, #009C3B 70%, transparent)',
          opacity: 0.6,
        }}
      />
    </div>
  )
}
