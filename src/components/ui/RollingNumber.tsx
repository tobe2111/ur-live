/**
 * 🎬 숫자가 굴러가며 바뀐다 (2026-11-02 시안 3차 "수량 + / −", 대표 *"모두 좋다 그렇게 해줘"*).
 *   늘면 아래에서 올라오고, 줄면 위에서 내려온다. 처음 그릴 때는 움직이지 않는다.
 *   ⚠️ 글자 폭은 그대로다(같은 칸 안에서 위아래로만) — 옆 버튼이 밀리지 않는다. 동작 줄이기면 CSS 가 끈다.
 */
import { useEffect, useRef, useState } from 'react'
import { injectMotionCss } from '@/lib/motion-css'
// 🎬 이 부품이 쓰는 움직임 CSS 만 — 불러올 때 한 번 꽂는다(lib/motion-css.ts 머리말)
injectMotionCss('ur-m-roll', `@keyframes ur-roll-out-up { to { transform: translateY(-100%); opacity: 0; } }@keyframes ur-roll-in-up { from { transform: translateY(100%); opacity: 0; } to { transform: none; opacity: 1; } }@keyframes ur-roll-out-down { to { transform: translateY(100%); opacity: 0; } }@keyframes ur-roll-in-down { from { transform: translateY(-100%); opacity: 0; } to { transform: none; opacity: 1; } }.ur-roll-out-up { animation: ur-roll-out-up .26s cubic-bezier(.65,0,.35,1) both; }.ur-roll-in-up { animation: ur-roll-in-up .26s cubic-bezier(.65,0,.35,1) both; }.ur-roll-out-down { animation: ur-roll-out-down .26s cubic-bezier(.65,0,.35,1) both; }.ur-roll-in-down { animation: ur-roll-in-down .26s cubic-bezier(.65,0,.35,1) both; }@media (prefers-reduced-motion: reduce){.ur-roll-out-up,.ur-roll-in-up,.ur-roll-out-down,.ur-roll-in-down{animation:none!important}}`)

export default function RollingNumber({ value, format = (n) => String(n), className = '' }: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const prev = useRef(value)
  const [out, setOut] = useState<{ v: number; up: boolean; k: number } | null>(null)
  const k = useRef(0)

  useEffect(() => {
    if (prev.current === value) return
    const up = value > prev.current
    k.current += 1
    setOut({ v: prev.current, up, k: k.current })
    prev.current = value
    const t = window.setTimeout(() => setOut(null), 280)
    return () => window.clearTimeout(t)
  }, [value])

  return (
    <span className={`relative inline-block overflow-hidden align-bottom ${className}`}>
      <span key={`in${k.current}`} className={`block ${out ? (out.up ? 'ur-roll-in-up' : 'ur-roll-in-down') : ''}`}>{format(value)}</span>
      {out && (
        <span key={`out${out.k}`} aria-hidden="true" className={`absolute inset-0 block ${out.up ? 'ur-roll-out-up' : 'ur-roll-out-down'}`}>{format(out.v)}</span>
      )}
    </span>
  )
}
