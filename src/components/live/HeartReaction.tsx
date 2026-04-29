import { useState, useRef, useEffect } from 'react'
import { Heart } from 'lucide-react'

export default function HeartReaction() {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const nextId = useRef(0)
  // 🛡️ 2026-04-22: setTimeout cleanup — unmount 시 보류 중인 timer 정리
  const timersRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    return () => {
      // unmount 시 모든 보류 타이머 clear
      timersRef.current.forEach(id => clearTimeout(id))
      timersRef.current.clear()
    }
  }, [])

  const addHeart = () => {
    const id = nextId.current++
    const x = Math.random() * 30 - 15
    setHearts(prev => [...prev.slice(-15), { id, x }])
    const timer = setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id))
      timersRef.current.delete(timer)
    }, 2000) as unknown as number
    timersRef.current.add(timer)
  }

  return (
    <div className="relative">
      <div className="absolute bottom-12 right-0 w-16 h-40 pointer-events-none overflow-hidden">
        {hearts.map(h => (
          <div key={h.id} className="absolute bottom-0 animate-float-heart" style={{ left: `calc(50% + ${h.x}px)` }}>
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          </div>
        ))}
      </div>
      <button
        onClick={addHeart}
        className="flex items-center justify-center rounded-full transition-all active:scale-125"
        style={{
          width: 40, height: 40,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        aria-label="Like"
      >
        {/* 🛡️ 2026-04-29 v4 Boutique 톤: Heart 18x18 + Pink fill (#F472B6) */}
        <Heart className="fill-current" style={{ width: 18, height: 18, color: '#F472B6' }} />
      </button>
    </div>
  )
}
