type Particle = {
  id: number
  x: number
  size: number
  duration: number
  delay: number
  iterations: number
  color: string
}

const COLORS = ['#FFDF00', '#FFDF00', '#FFDF00', '#009C3B', '#009C3B', '#002776']
const TOTAL_SECONDS = 20

const particles: Particle[] = Array.from({ length: 22 }, (_, i) => {
  const duration = 5 + (i % 6) * 1.2
  const delay = i * 0.25
  // Each particle runs only enough iterations to fill ~20s, then stops naturally
  const iterations = Math.max(1, Math.ceil((TOTAL_SECONDS - delay) / duration))
  return {
    id: i,
    x: Math.random() * 94 + 1,
    size: 7 + (i % 4) * 2.5,
    duration,
    delay,
    iterations,
    color: COLORS[i % COLORS.length],
  }
})

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
            animation: `brazil-fall ${p.duration}s ${p.delay}s linear ${p.iterations}`,
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
