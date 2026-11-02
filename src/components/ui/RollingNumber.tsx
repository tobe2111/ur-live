/**
 * 🎬 숫자가 굴러가며 바뀐다 (2026-11-02 시안 3차 "수량 + / −", 대표 *"모두 좋다 그렇게 해줘"*).
 *   늘면 아래에서 올라오고, 줄면 위에서 내려온다. 처음 그릴 때는 움직이지 않는다.
 *   ⚠️ 글자 폭은 그대로다(같은 칸 안에서 위아래로만) — 옆 버튼이 밀리지 않는다. 동작 줄이기면 CSS 가 끈다.
 */
import { useEffect, useRef, useState } from 'react'

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
