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

const particles: Particle[] = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i / 22) * 98 + Math.sin(i * 2.4) * 4,
  size: 7 + (i % 4) * 2.5,
  duration: 5 + (i % 6) * 1.2,
  delay: i * 0.25,
  color: COLORS[i % COLORS.length],
}))

export default function BrazilDayOverlay() {
  const [opacity, setOpacity] = useState(1)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(0), 9000)
    const removeTimer = setTimeout(() => setGone(true), 10000)
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer) }
  }, [])

  if (gone) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
        overflow: 'hidden',
        opacity,
        transition: 'opacity 1s linear',
      }}
    >
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-5vh',
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: 'rotate(45deg)',
            opacity: 0,
            animation: `brazil-fall ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
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
