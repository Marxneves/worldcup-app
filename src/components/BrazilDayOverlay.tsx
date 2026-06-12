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
  return Array.from({ length: count }, (_, i) => {
    const duration = 5 + (i % 6) * 1.2
    // Each particle starts between 10% and 90% through its own cycle
    // so they are already spread across the screen on first render
    const progress = 0.1 + (i / count) * 0.8
    return {
      id: i,
      x: (i / count) * 98 + Math.sin(i * 2.4) * 4,
      size: 7 + (i % 4) * 2.5,
      duration,
      delay: -(duration * progress),
      color: COLORS[i % COLORS.length],
    }
  })
}

const particles = generateParticles(22)

export default function BrazilDayOverlay() {
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
