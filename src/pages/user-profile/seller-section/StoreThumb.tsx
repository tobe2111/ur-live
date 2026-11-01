import { useState } from 'react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

/**
 * 🖼️ 가게 머리줄·매장 고르기 창의 가게 사진 (2026-10-31 대표 확정 9번 B안).
 * 사진이 없거나 못 불러오면 **가게 이름 첫 글자** — 빈 회색 칸은 어느 가게인지 말해 주지 않는다.
 * `hidden` 이면 자리만 차지한다(기다리는 동안 머리줄 높이가 도착 뒤와 같게).
 */
export default function StoreThumb({ src, name, size = 48, hidden = false }: {
  src: string | null
  name: string
  size?: number
  hidden?: boolean
}) {
  const [dead, setDead] = useState(false)
  const box = { width: size, height: size }
  if (hidden) return <span className="shrink-0 rounded-xl invisible" style={box} aria-hidden="true" />
  if (!src || dead) {
    return (
      <span
        className="shrink-0 rounded-xl bg-brand-tint text-brand-text flex items-center justify-center text-[17px] font-bold"
        style={box}
        aria-hidden="true"
      >
        {(name.trim()[0] || '가').toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={cfImage(src, { width: size * 2, height: size * 2, fit: 'cover' })}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={(e) => { cfImageOnError(e.currentTarget, src); if (e.currentTarget.dataset.cfFallback === '2') setDead(true) }}
      className="shrink-0 rounded-xl object-cover bg-gray-100 dark:bg-gray-800"
      style={box}
    />
  )
}
