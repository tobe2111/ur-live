import { useState, useRef } from 'react'
import { Heart } from 'lucide-react'

export default function HeartReaction() {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const nextId = useRef(0)

  const addHeart = () => {
    const id = nextId.current++
    const x = Math.random() * 30 - 15
    setHearts(prev => [...prev.slice(-15), { id, x }])
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000)
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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-125"
        aria-label="Like"
      >
        <Heart className="h-5 w-5 text-pink-400 fill-pink-400" />
      </button>
    </div>
  )
}
