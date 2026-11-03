import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 📦 화면 근처(아래 120px 안)에 왔을 때만 자식을 그린다 — 2026-11-03 유어샵 SNS 최근 게시물.
 *   첫 화면에 지연 부품을 그냥 두면 그 코드 파일을 **첫 화면에서** 받는다(유어샵 26 → 27, 래칫 빨간불).
 *   진열 아래에 있는 것은 사람이 거기까지 내려야 보이므로, 그때 받아도 늦지 않다.
 *   IntersectionObserver 가 없는 환경(구형·시험)은 바로 그린다.
 */
export default function NearViewport({ children }: { children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (near || !ref.current) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '120px 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [near])
  return near ? <>{children()}</> : <div ref={ref} aria-hidden="true" />
}
