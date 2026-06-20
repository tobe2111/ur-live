/**
 * 🛡️ 2026-05-15: 100% 달성 축하 confetti — pure CSS, 외부 lib 0.
 *
 * 사용:
 *   {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
 *
 * 4초 후 자동 사라짐.
 */
import { useEffect, useState } from 'react'

const COLORS = ['#6b7280', '#6b7280', '#9ca3af', '#6b7280', '#374151', '#4b5563']
const PIECES = 60

export default function Confetti({ onDone }: { onDone?: () => void }) {
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1500,
      duration: 2500 + Math.random() * 1500,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }))
  )

  useEffect(() => {
    const t = setTimeout(() => { if (onDone) onDone() }, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}ms ease-in ${p.delay}ms forwards`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}
